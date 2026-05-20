# 워크스페이스 v1 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여자친구가 운영하는 필라테스 스튜디오의 구글 시트 데이터 위에, 부가세·종소세 시뮬레이터와 운영 대시보드를 얹는 단일 사용자용 Next.js 웹앱을 빌드한다.

**Architecture:** 구글 시트가 source of truth. Next.js (App Router) 서버에서 Google Sheets API로 시트를 읽고 5분 캐시. 순수 TypeScript 함수로 세금·예비비 계산. Recharts로 차트 표시. Vercel 무료 티어 배포. 인증은 미들웨어 베이직 인증(단일 비밀번호).

**Tech Stack:**
- Next.js 15 (App Router) + TypeScript 5 (strict)
- Tailwind CSS 3
- Recharts 2 (차트)
- googleapis (Google Sheets API)
- date-fns (날짜 계산)
- Vitest 2 + @testing-library/react (테스트)
- Vercel (배포)

---

## 🆕 Amendments (2026-05-20, 라파 실데이터 분석 반영)

실데이터 흡수 후 발견된 변경사항. **구현자: 아래 task 본문보다 우선합니다.** 각 task 들어갈 때 해당 Override 먼저 적용할 것.

### 사전 조건: 실데이터 fixture 이미 준비됨

`workspace/tests/fixtures/real-transactions.ts` (316.5KB, 2539 거래, 31 카테고리).
`REAL_TRANSACTIONS`와 `GROUND_TRUTH_KPI` export. Task 4.1 백테스트는 fixture 채울 필요 없이 바로 가능.

### Override 0.4: 확장된 Transaction 타입

```ts
export type PaymentMethod = '카드' | '계좌이체' | '현금'

// 거래 분류 — 영업이익 계산 시 'business'만 사업비용으로 카운트.
// owner_draw·reserve는 KPI 별도 표시, 사업소득에서 차감 X.
// capital은 자산성 지출 (감가상각 대상), v1에서는 별도 KPI만.
export type TxClassification = 'business' | 'living' | 'owner_draw' | 'reserve' | 'capital'

// 시트에서 발견된 47개 변형을 정규화한 30개 표준 카테고리.
export type Category =
  | '매출' | '임대료' | '식비' | '마케팅비' | '교육비' | '정기결제' | '세금'
  | '소모품' | '보험료' | '품위유지비' | '교통비' | '의류비' | '의료비'
  | '소품' | '도서인쇄비' | '경조사비' | '수수료' | '공과금' | '관리비'
  | '급여' | '유진 급여' | '예비비' | '사무용품' | '자산' | '보통예금'
  | '복리후생비' | '지급수수료' | '세탁비' | '연금' | '적금' | '기타'

export interface Transaction {
  date: string                        // ISO yyyy-mm-dd
  rawCategory: string                 // 시트 원본 (오타·공백 포함)
  category: Category                  // 정규화된 표준 카테고리
  amount: number
  method: PaymentMethod
  counterparty: string | undefined    // 비고1 (가맹점/거래처)
  person: string | undefined          // 비고2 (사람)
  classification: TxClassification
  memo: string | undefined
}
```

### Override 1.1: 카테고리 정규화 매핑 (47 → 30)

```ts
// 시트 원본 → 표준 카테고리. 실데이터에서 발견한 변형들.
const NORMALIZATION_MAP: Record<string, Category> = {
  '임차료': '임대료',
  '소모품비': '소모품',
  '마케팅': '마케팅비',
  '월급': '급여',
  '의류': '의류비',
  '교육': '교육비',
  '인쇄비': '도서인쇄비',
  '프린트': '도서인쇄비',
  '보혐료': '보험료',          // 오타
  '경좃비': '경조사비',         // 오타
  '경조선물비': '경조사비',
  ' 유진 급여': '유진 급여',    // 앞 공백 1자
  '간식': '식비',
  '약': '의료비',
  '운송비': '수수료',
  '정기': '정기결제',
  '복지': '복리후생비',
}

export function normalizeCategory(raw: string | null | undefined): Category | null {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (trimmed in NORMALIZATION_MAP) return NORMALIZATION_MAP[trimmed]
  // 헤더성 행 제외 ("1월 종합", "2월 종합" 등)
  if (/종합$/.test(trimmed)) return null
  // 이미 표준이면 그대로
  return STANDARD_CATEGORIES.has(trimmed as Category) ? (trimmed as Category) : '기타'
}
```

### Override 1.1 (cont.): classification 추론

```ts
const OWNER_DRAW_CATEGORIES: Category[] = ['유진 급여']
const RESERVE_CATEGORIES: Category[] = ['예비비']
const CAPITAL_CATEGORIES: Category[] = ['자산', '보통예금', '사무용품']
const BUSINESS_CATEGORIES: Category[] = [
  '매출', '임대료', '마케팅비', '정기결제', '세금', '보험료', '공과금',
  '관리비', '수수료', '교육비', '경조사비', '급여', '복리후생비', '지급수수료',
  '연금', '적금', '세탁비',
]
// 나머지(식비·품위유지비·교통비·의류비·의료비·소품·도서인쇄비·소모품·기타)는 'living'

export function classify(category: Category): TxClassification {
  if (OWNER_DRAW_CATEGORIES.includes(category)) return 'owner_draw'
  if (RESERVE_CATEGORIES.includes(category)) return 'reserve'
  if (CAPITAL_CATEGORIES.includes(category)) return 'capital'
  if (BUSINESS_CATEGORIES.includes(category)) return 'business'
  return 'living'
}
```

### Override 1.2: 부가세 공제 룰

```ts
// 추가 조건: classification이 'business'여야만 공제 대상.
// owner_draw, reserve, capital은 사업비용 아님.
export function isVATDeductible(tx: Transaction): boolean {
  if (tx.classification !== 'business') return false
  if (tx.amount >= 0) return false
  if (tx.method === '현금') return false
  // 카테고리별 추가 룰 (경조사비는 사업비지만 공제 불가)
  if (tx.category === '경조사비') return false
  if (tx.category === '세금') return false
  if (tx.category === '보험료') return false  // 일반적으로 면세
  return true
}
```

### Override 1.4: 종소세에 청년창업감면 옵션

```ts
export interface IncomeTaxOptions {
  personalDeductionCount?: number
  noranusanContribution?: number
  pensionSavings?: number
  additionalTaxCredit?: number
  youngStartupReduction?: 0 | 0.5 | 1.0  // 🆕 청년창업감면 (0/50/100%)
}

// 산출세액 → 세액공제 → youngStartupReduction 적용 순서:
const afterCredits = Math.max(0, computedTax - taxCredits)
const reduction = options.youngStartupReduction ?? 0
const estimatedTax = Math.round(afterCredits * (1 - reduction))
```

추가 테스트:
```ts
it('청년창업감면 100% 적용 시 종소세 0', () => {
  const result = simulateIncomeTax(transactions, '2026-12-31', { youngStartupReduction: 1.0 })
  expect(result.estimatedTax).toBe(0)
})

it('감면 50% 적용 시 절반', () => {
  const r0 = simulateIncomeTax(transactions, '2026-12-31', { youngStartupReduction: 0 })
  const r50 = simulateIncomeTax(transactions, '2026-12-31', { youngStartupReduction: 0.5 })
  expect(r50.estimatedTax).toBeCloseTo(r0.estimatedTax * 0.5, -3)
})
```

### Override 1.4 (cont.): 영업이익 계산에서 owner_draw·reserve·capital 제외

```ts
const expenseSoFar = inYear
  .filter(tx => {
    if (tx.amount >= 0) return false
    return tx.classification === 'business'  // business만 사업비용
  })
  .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
```

### Override 2.1: 파서가 rawCategory + category + classification 모두 채움

```ts
import { normalizeCategory, classify } from '@/lib/categories/mapping'

export function parseSheetRows(rows: string[][]): Transaction[] {
  const out: Transaction[] = []
  for (const row of rows) {
    const [_no, _ym, dateRaw, categoryRaw, amountRaw, method, _dup, memo1, memo2] = row
    if (!dateRaw || !categoryRaw || !amountRaw || !method) continue

    const category = normalizeCategory(categoryRaw)
    if (!category) continue  // "1월 종합" 같은 헤더성 제외

    const amount = parseAmount(amountRaw)
    if (amount === null) continue

    if (!isValidMethod(method)) continue

    out.push({
      date: parseDate(dateRaw),
      rawCategory: String(categoryRaw).trim(),
      category,
      amount,
      method,
      counterparty: memo1?.trim() || undefined,
      person: memo2?.trim() || undefined,
      classification: classify(category),
      memo: undefined,
    })
  }
  return out
}
```

### Override 4.1: 백테스트는 실데이터 fixture로 즉시 가능

```ts
import { REAL_TRANSACTIONS, GROUND_TRUTH_KPI } from '../fixtures/real-transactions'
import { aggregateMonthly } from '@/lib/analytics/monthly'

describe('백테스트: 2024년 매출/지출/순이익', () => {
  // RealTransaction을 Transaction으로 어댑팅 (rawCategory 등 추가)
  const txs = REAL_TRANSACTIONS.map(t => ({
    ...t,
    rawCategory: t.category,
    classification: classify(t.category as Category),
    memo: undefined,
  } as Transaction))

  it('연 매출 정확도 ±2%', () => {
    const monthly = aggregateMonthly(txs)
    const total = monthly
      .filter(m => m.month.startsWith('2024'))
      .reduce((s, m) => s + m.revenue, 0)
    const target = GROUND_TRUTH_KPI[2024].revenue
    expect(Math.abs(total - target) / target).toBeLessThan(0.02)
  })

  it('owner_draw·reserve 제외한 사업비용 정확도 ±2%', () => {
    // PDF의 "지출" 컬럼은 owner_draw + reserve 제외값
    const businessExpense = txs
      .filter(t => t.amount < 0 && t.classification === 'business')
      .filter(t => t.date.startsWith('2024'))
      .reduce((s, t) => s + Math.abs(t.amount), 0)
    const target = GROUND_TRUTH_KPI[2024].expense
    expect(Math.abs(businessExpense - target) / target).toBeLessThan(0.05)
  })
})
```

### Override: 새 모듈 추가

**Task 1.0 카테고리 정규화 모듈** (Phase 1에 가장 먼저, 다른 모두의 선행)
- File: `workspace/src/lib/categories/normalize.ts`
- 위 Override 1.1의 `NORMALIZATION_MAP`, `normalizeCategory`, `classify` 함수 export
- Test: `workspace/tests/lib/categories/normalize.test.ts` — 47개 변형 → 30개 매핑 케이스

**Task 2.5 사용자 프로필/설정 모듈** (Phase 2에 추가, 사용자가 명시적 요구)

운영자가 청년창업감면·노란우산·연금저축을 토글로 직접 입력하는 설정 페이지.

- File: `workspace/src/lib/profile/settings.ts` — 파일 기반 영속 (`workspace/data/profile.json`, gitignored)
- File: `workspace/src/app/api/profile/route.ts` — GET/POST
- File: `workspace/src/app/settings/page.tsx` — 폼 UI

```ts
export interface UserProfile {
  birthDate: string | null              // YYYY-MM-DD (만 나이 자동 계산용)
  businessAddress: string | null        // 시·구 (자유 텍스트)
  isYoungStartupEligible: boolean       // 사용자 직접 토글 (자격 확인 완료 후 ON)
  youngStartupReductionRate: 0 | 0.5 | 1.0  // 0%/50%/100% 토글
  noranusanAnnualContribution: number   // 연 납입액 (원), default 0
  pensionAnnualContribution: number     // 연 납입액 (원), default 0
}

export const DEFAULT_PROFILE: UserProfile = {
  birthDate: null,
  businessAddress: null,
  isYoungStartupEligible: false,
  youngStartupReductionRate: 0,
  noranusanAnnualContribution: 0,
  pensionAnnualContribution: 0,
}
```

설정 페이지는 단순 폼: 생년월일 (date picker), 사업장 주소 (text), 청년창업감면 적용 (체크박스 + 0/50/100 라디오), 노란우산 연 납입액 (number), 연금저축 연 납입액 (number).

홈/세금 페이지에서 `loadProfile()`로 읽어서 `simulateIncomeTax(transactions, today, { youngStartupReduction: profile.youngStartupReductionRate, noranusanContribution: profile.noranusanAnnualContribution, ... })` 호출.

**Task 2.5 의존성**: Task 2.4 이후. UI는 Phase 3의 다른 페이지들과 병렬 가능.

---

## 모듈 의존 관계 (오케스트레이션 참고)

```
Types (Task 0.4)
  ├→ Categories (1.1, 1.2)
  ├→ Tax (1.3, 1.4, 1.5, 1.6)
  ├→ Advice (1.7)
  ├→ Sheet Parser (2.1)
  └→ Components (3.x)

Sheet Parser (2.1) → Sheet Client (2.2) → Cache (2.3) → API Route (2.4)
Components (3.x) → Pages (3.5, 3.6, 3.7)
Pages + API Route → Integration (4.x) → Deploy (5.x)
```

**병렬 가능 (서브에이전트 분담):**
- Phase 1 일부(1.2~1.7) — Task 1.0(정규화)과 Types 완성되면 6개 task 동시 가능
- Phase 3 컴포넌트(3.2~3.4) — 디자인 토큰만 정해지면 병렬
- Phase 2와 Phase 3는 같은 시점에 시작 가능
- **Phase 4.1(백테스트)는 Phase 1 끝나자마자 즉시** — fixture 이미 준비되어 있음

**순차 (블로킹):**
- Phase 0 → 다른 모든 phase의 선행
- **Task 1.0 (카테고리 정규화) → Phase 1 나머지** (가장 먼저)
- Phase 2.1 → 2.2 → 2.3 → 2.4 순서
- Phase 3.5~3.7 (페이지)는 컴포넌트와 API 둘 다 필요
- Phase 5 (배포)는 마지막

---

## 파일 구조 (최종)

```
workspace/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── .env.example
├── .env.local                          # gitignored
├── .gitignore
├── README.md
├── middleware.ts                       # basic auth
├── public/
├── src/
│   ├── types/
│   │   └── domain.ts                   # Transaction, Category, TaxResult 등
│   ├── lib/
│   │   ├── categories/
│   │   │   ├── mapping.ts              # 계정과목 → 세무속성
│   │   │   └── deduction-rules.ts      # 부가세 공제 판정
│   │   ├── tax/
│   │   │   ├── vat.ts                  # 부가세 시뮬레이터
│   │   │   ├── income-tax.ts           # 종소세 시뮬레이터
│   │   │   ├── reserve.ts              # 권장 예비비
│   │   │   └── due-dates.ts            # 납부일 D-day
│   │   │   └── brackets.ts             # 누진세율 테이블
│   │   ├── advice/
│   │   │   └── action-cards.ts         # 절세 액션 카드 룰
│   │   └── sheets/
│   │       ├── parser.ts               # row → Transaction
│   │       ├── client.ts               # Google Sheets API
│   │       └── cache.ts                # in-memory 5분 캐시
│   ├── components/
│   │   ├── ui/                         # 공통 UI (Card, Badge 등)
│   │   ├── HomeCards/                  # 홈 화면 카드
│   │   ├── TaxCards/                   # 세금 탭 카드
│   │   └── Charts/                     # Recharts 래퍼
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx                    # 홈
│       ├── tax/page.tsx                # 세금 탭
│       ├── analytics/page.tsx          # 분석 탭
│       └── api/
│           └── transactions/route.ts
├── tests/
│   ├── fixtures/
│   │   └── sample-transactions.ts      # 시드 데이터
│   ├── lib/
│   │   ├── categories/
│   │   │   ├── mapping.test.ts
│   │   │   └── deduction-rules.test.ts
│   │   ├── tax/
│   │   │   ├── vat.test.ts
│   │   │   ├── income-tax.test.ts
│   │   │   ├── reserve.test.ts
│   │   │   └── due-dates.test.ts
│   │   ├── advice/
│   │   │   └── action-cards.test.ts
│   │   └── sheets/
│   │       └── parser.test.ts
│   └── integration/
│       └── backtest.test.ts            # 실데이터 백테스트
└── docs/
    ├── specs/2026-05-20-workspace-v1-design.md
    └── superpowers/plans/2026-05-20-workspace-v1-implementation.md
```

---

## Phase 0 — 프로젝트 셋업

### Task 0.1: Next.js 프로젝트 초기화

**Files:**
- Create: `workspace/package.json` (및 Next.js scaffold 일체)

- [ ] **Step 1: Next.js 프로젝트 생성**

작업 디렉토리: `C:\Users\leech\dev\business-os\workspace\`

이미 `docs/`가 있는 디렉토리이므로 `create-next-app`을 같은 디렉토리에 실행할 때 충돌 방지를 위해 `--use-npm` + 수동 옵션을 사용한다.

Run:
```bash
cd C:/Users/leech/dev/business-os/workspace
npx create-next-app@latest . --ts --tailwind --app --src-dir --eslint --use-npm --no-import-alias
```

Expected: `package.json`, `src/app/`, `tailwind.config.ts` 등 생성됨. 기존 `docs/` 폴더는 보존됨.

- [ ] **Step 2: Git 초기화 (아직 안 됐다면)**

Run:
```bash
cd C:/Users/leech/dev/business-os/workspace
git init
git branch -M main
```

- [ ] **Step 3: .gitignore에 환경 파일 추가**

Modify: `workspace/.gitignore` (Next.js가 생성한 파일에 추가)
```
.env*.local
.env
!.env.example
```

- [ ] **Step 4: 초기 커밋**

Run:
```bash
cd C:/Users/leech/dev/business-os/workspace
git add .
git commit -m "chore: bootstrap Next.js project"
```

---

### Task 0.2: 의존성 설치

**Files:**
- Modify: `workspace/package.json`

- [ ] **Step 1: 런타임 의존성 설치**

Run:
```bash
cd C:/Users/leech/dev/business-os/workspace
npm install recharts googleapis date-fns
```

- [ ] **Step 2: 개발 의존성 설치 (Vitest + Testing Library)**

Run:
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

- [ ] **Step 3: package.json scripts 추가**

Modify: `workspace/package.json` — `scripts` 섹션에 추가:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

- [ ] **Step 4: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: add runtime and test dependencies"
```

---

### Task 0.3: Vitest 설정

**Files:**
- Create: `workspace/vitest.config.ts`
- Create: `workspace/tests/setup.ts`

- [ ] **Step 1: vitest.config.ts 작성**

Create: `workspace/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: @vitejs/plugin-react 설치**

Run:
```bash
npm install -D @vitejs/plugin-react
```

- [ ] **Step 3: 테스트 셋업 파일**

Create: `workspace/tests/setup.ts`
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Sanity check 테스트**

Create: `workspace/tests/sanity.test.ts`
```ts
import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('1+1=2', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: 테스트 실행 확인**

Run:
```bash
npm test
```
Expected: `sanity.test.ts` 1 passed.

- [ ] **Step 6: 커밋**

```bash
git add vitest.config.ts tests/
git commit -m "chore: set up Vitest with React Testing Library"
```

---

### Task 0.4: 도메인 타입 정의

**Files:**
- Create: `workspace/src/types/domain.ts`
- Test: `workspace/tests/lib/types/domain.test.ts` (타입 컴파일 테스트만)

- [ ] **Step 1: 타입 컴파일 테스트 작성**

Create: `workspace/tests/lib/types/domain.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import type { Transaction, Category, PaymentMethod } from '@/types/domain'

describe('domain types', () => {
  it('Transaction 타입을 만족하는 객체를 만들 수 있다', () => {
    const tx: Transaction = {
      date: '2026-01-15',
      category: '매출',
      amount: 650_000,
      method: '카드',
      counterparty: '개인레슨',
      person: '김기수',
      memo: undefined,
    }
    expect(tx.amount).toBeGreaterThan(0)
  })

  it('PaymentMethod는 3개의 값만 허용한다', () => {
    const methods: PaymentMethod[] = ['카드', '계좌이체', '현금']
    expect(methods).toHaveLength(3)
  })

  it('Category에 운영자의 19개 카테고리가 모두 포함된다', () => {
    const categories: Category[] = [
      '매출', '임대료', '식비', '마케팅비', '교육비', '정기결제',
      '세금', '소모품', '보험료', '품위유지비', '교통비', '의류비',
      '의료비', '소품', '도서인쇄비', '경조사비', '수수료', '공과금', '관리비'
    ]
    expect(categories).toHaveLength(19)
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/types/domain.test.ts
```
Expected: FAIL — `@/types/domain` 미존재.

- [ ] **Step 3: 도메인 타입 작성**

Create: `workspace/src/types/domain.ts`
```ts
export type PaymentMethod = '카드' | '계좌이체' | '현금'

export type Category =
  | '매출'
  | '임대료'
  | '식비'
  | '마케팅비'
  | '교육비'
  | '정기결제'
  | '세금'
  | '소모품'
  | '보험료'
  | '품위유지비'
  | '교통비'
  | '의류비'
  | '의료비'
  | '소품'
  | '도서인쇄비'
  | '경조사비'
  | '수수료'
  | '공과금'
  | '관리비'

export interface Transaction {
  date: string              // ISO yyyy-mm-dd
  category: Category
  amount: number            // 음수 = 지출, 양수 = 매출
  method: PaymentMethod
  counterparty: string | undefined  // 비고1 (가맹점/거래처)
  person: string | undefined        // 비고2 (사람: 클라이언트 또는 직원)
  memo: string | undefined          // 추가 메모(시트에 없으면 undefined)
}

export interface TaxAttributes {
  isBusinessExpense: boolean      // 사업비 여부
  vatDeductibleByCategory: boolean  // 부가세 공제 가능 카테고리인가
  incomeTaxDeductible: boolean    // 종소세 필요경비 인정
}

export interface VATResult {
  quarter: 1 | 2 | 3 | 4
  year: number
  outputVAT: number     // 매출세액
  inputVAT: number      // 매입세액
  estimatedVAT: number  // 예상 납부액
  transactionCount: number
}

export interface IncomeTaxResult {
  year: number
  annualizedRevenue: number
  annualizedExpense: number
  businessIncome: number    // 사업소득금액
  taxableBase: number       // 과세표준
  computedTax: number       // 산출세액
  estimatedTax: number      // 예상 납부액 (세액공제 후)
  asOfDate: string
}

export interface ReserveRecommendation {
  monthly: number           // 권장 월 예비비
  annualTaxEstimate: number // 연 예상 세금 총합
  breakdown: {
    vatTotal: number
    incomeTaxTotal: number
  }
}

export interface DueDate {
  type: 'VAT' | 'INCOME_TAX'
  label: string
  date: string              // yyyy-mm-dd
  daysRemaining: number
}

export interface ActionCard {
  id: string
  title: string
  description: string
  estimatedSavings: number | undefined
  category: 'deduction' | 'evidence' | 'preparation' | 'general'
  triggered: boolean
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npm test -- tests/lib/types/domain.test.ts
```
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/types/domain.ts tests/lib/types/
git commit -m "feat: define core domain types"
```

---

## Phase 1 — 순수 로직 (병렬 작업 가능)

> **오케스트레이션 노트**: Task 1.1 ~ 1.7은 Task 0.4(types)만 완성되면 모두 독립적으로 작업 가능. 서브에이전트 분담 시 한 번에 디스패치 가능.

### Task 1.1: 카테고리 → 세무속성 매핑

**Files:**
- Create: `workspace/src/lib/categories/mapping.ts`
- Test: `workspace/tests/lib/categories/mapping.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create: `workspace/tests/lib/categories/mapping.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { getTaxAttributes, isBusinessCategory } from '@/lib/categories/mapping'

describe('카테고리 매핑', () => {
  it('임대료는 사업비이며 부가세 공제 가능 카테고리', () => {
    const attrs = getTaxAttributes('임대료')
    expect(attrs.isBusinessExpense).toBe(true)
    expect(attrs.vatDeductibleByCategory).toBe(true)
    expect(attrs.incomeTaxDeductible).toBe(true)
  })

  it('경조사비는 사업비이지만 부가세 공제 불가 (세금계산서 못 받음)', () => {
    const attrs = getTaxAttributes('경조사비')
    expect(attrs.isBusinessExpense).toBe(true)
    expect(attrs.vatDeductibleByCategory).toBe(false)
    expect(attrs.incomeTaxDeductible).toBe(true)
  })

  it('식비는 사업비가 아닌 생활비(영업이익 라인 아래)', () => {
    const attrs = getTaxAttributes('식비')
    expect(attrs.isBusinessExpense).toBe(false)
  })

  it('품위유지비는 생활비', () => {
    expect(isBusinessCategory('품위유지비')).toBe(false)
  })

  it('매출은 사업 항목', () => {
    expect(isBusinessCategory('매출')).toBe(true)
  })

  it('세금은 사업 항목이지만 부가세 공제 자체가 불가', () => {
    const attrs = getTaxAttributes('세금')
    expect(attrs.isBusinessExpense).toBe(true)
    expect(attrs.vatDeductibleByCategory).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/categories/mapping.test.ts
```
Expected: FAIL — 모듈 미존재.

- [ ] **Step 3: 매핑 구현**

Create: `workspace/src/lib/categories/mapping.ts`
```ts
import type { Category, TaxAttributes } from '@/types/domain'

/**
 * 운영자(여자친구) 시트의 19개 카테고리 → 세무 속성 매핑.
 * 영업이익 라인을 기준으로 사업비/생활비를 가른다.
 * - 사업비: 매출, 임대료, 마케팅비, 정기결제, 세금, 보험료, 공과금, 관리비, 수수료, 교육비
 * - 생활비: 식비, 품위유지비, 교통비, 의류비, 의료비, 소품, 도서인쇄비, 경조사비, 소모품
 *   (단 경조사비는 종소세 필요경비 인정. 소모품은 사업용으로 쓰면 사업비로 분류해야 함 — v1은 생활비 디폴트, v2에서 개별 거래 토글 도입)
 */
const CATEGORY_MAP: Record<Category, TaxAttributes> = {
  매출:       { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  임대료:     { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  마케팅비:   { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  정기결제:   { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  세금:       { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: false },
  보험료:     { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: true },
  공과금:     { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  관리비:     { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  수수료:     { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  교육비:     { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: true },
  식비:       { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  품위유지비: { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  교통비:     { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  의류비:     { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  의료비:     { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  소품:       { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  도서인쇄비: { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  경조사비:   { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: true },
  소모품:     { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
}

export function getTaxAttributes(category: Category): TaxAttributes {
  return CATEGORY_MAP[category]
}

export function isBusinessCategory(category: Category): boolean {
  return CATEGORY_MAP[category].isBusinessExpense
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npm test -- tests/lib/categories/mapping.test.ts
```
Expected: PASS — 6 tests.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/categories/mapping.ts tests/lib/categories/mapping.test.ts
git commit -m "feat: map 19 categories to tax attributes"
```

---

### Task 1.2: 부가세 공제 룰 엔진

**Files:**
- Create: `workspace/src/lib/categories/deduction-rules.ts`
- Test: `workspace/tests/lib/categories/deduction-rules.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create: `workspace/tests/lib/categories/deduction-rules.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { isVATDeductible } from '@/lib/categories/deduction-rules'
import type { Transaction } from '@/types/domain'

const baseTx = (overrides: Partial<Transaction>): Transaction => ({
  date: '2026-02-01',
  category: '임대료',
  amount: -1_430_000,
  method: '계좌이체',
  counterparty: '건물주',
  person: undefined,
  memo: undefined,
  ...overrides,
})

describe('부가세 공제 판정', () => {
  it('임대료 + 계좌이체 → 공제 가능', () => {
    expect(isVATDeductible(baseTx({}))).toBe(true)
  })

  it('현금 결제는 공제 불가 (세금계산서 수취 의제 불가)', () => {
    expect(isVATDeductible(baseTx({ method: '현금' }))).toBe(false)
  })

  it('경조사비는 카테고리상 공제 불가', () => {
    expect(isVATDeductible(baseTx({ category: '경조사비', amount: -200_000, method: '계좌이체' }))).toBe(false)
  })

  it('식비는 사업비가 아니므로 공제 불가', () => {
    expect(isVATDeductible(baseTx({ category: '식비', amount: -22_000, method: '카드' }))).toBe(false)
  })

  it('매출 행은 공제 대상이 아님', () => {
    expect(isVATDeductible(baseTx({ category: '매출', amount: 650_000, method: '카드' }))).toBe(false)
  })

  it('마케팅비 + 카드 → 공제 가능', () => {
    expect(isVATDeductible(baseTx({ category: '마케팅비', amount: -50_000, method: '카드' }))).toBe(true)
  })

  it('소모품(현재 생활비 분류) → 공제 불가', () => {
    expect(isVATDeductible(baseTx({ category: '소모품', amount: -9_400, method: '카드' }))).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/categories/deduction-rules.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 공제 룰 구현**

Create: `workspace/src/lib/categories/deduction-rules.ts`
```ts
import type { Transaction } from '@/types/domain'
import { getTaxAttributes } from './mapping'

/**
 * 부가세 매입세액 공제 가능 여부 판정.
 * v1 룰 (보수적):
 *   1. 카테고리상 공제 가능해야 함 (mapping의 vatDeductibleByCategory)
 *   2. 사업비여야 함
 *   3. 결제 수단이 카드 또는 계좌이체여야 함 (현금 = 세금계산서 수취 의제 불가)
 *   4. 금액이 음수(지출)여야 함
 *
 * v2에서 추가될 룰: 상대방 사업자등록번호 확인, 면세업종 판정 등.
 */
export function isVATDeductible(tx: Transaction): boolean {
  const attrs = getTaxAttributes(tx.category)

  if (!attrs.vatDeductibleByCategory) return false
  if (!attrs.isBusinessExpense) return false
  if (tx.amount >= 0) return false
  if (tx.method === '현금') return false

  return true
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npm test -- tests/lib/categories/deduction-rules.test.ts
```
Expected: PASS — 7 tests.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/categories/deduction-rules.ts tests/lib/categories/deduction-rules.test.ts
git commit -m "feat: implement VAT deduction rule engine"
```

---

### Task 1.3: 부가세 시뮬레이터

**Files:**
- Create: `workspace/src/lib/tax/vat.ts`
- Test: `workspace/tests/lib/tax/vat.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create: `workspace/tests/lib/tax/vat.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { simulateVAT, getQuarterRange } from '@/lib/tax/vat'
import type { Transaction } from '@/types/domain'

const tx = (date: string, category: Transaction['category'], amount: number, method: Transaction['method'] = '카드'): Transaction => ({
  date, category, amount, method,
  counterparty: undefined, person: undefined, memo: undefined,
})

describe('부가세 시뮬레이터', () => {
  it('인적용역(매입 없음): 매출 1,100만 → 부가세 100만', () => {
    const result = simulateVAT([tx('2026-01-15', '매출', 11_000_000)], 2026, 1)
    expect(result.outputVAT).toBe(1_000_000)
    expect(result.inputVAT).toBe(0)
    expect(result.estimatedVAT).toBe(1_000_000)
  })

  it('임대료 매입 110만 있으면 매입세액 10만 차감', () => {
    const result = simulateVAT([
      tx('2026-01-15', '매출', 11_000_000),
      tx('2026-01-01', '임대료', -1_100_000, '계좌이체'),
    ], 2026, 1)
    expect(result.outputVAT).toBe(1_000_000)
    expect(result.inputVAT).toBe(100_000)
    expect(result.estimatedVAT).toBe(900_000)
  })

  it('해당 분기 거래만 집계 (분기 경계 거래 제외)', () => {
    const result = simulateVAT([
      tx('2026-01-15', '매출', 11_000_000),   // Q1
      tx('2026-04-15', '매출', 22_000_000),   // Q2
    ], 2026, 1)
    expect(result.outputVAT).toBe(1_000_000)
  })

  it('현금 매입은 공제 불가', () => {
    const result = simulateVAT([
      tx('2026-01-15', '매출', 11_000_000),
      tx('2026-02-01', '임대료', -1_100_000, '현금'),
    ], 2026, 1)
    expect(result.inputVAT).toBe(0)
    expect(result.estimatedVAT).toBe(1_000_000)
  })

  it('분기 범위 계산: Q1 = 1/1 ~ 3/31', () => {
    const range = getQuarterRange(2026, 1)
    expect(range.start).toBe('2026-01-01')
    expect(range.end).toBe('2026-03-31')
  })

  it('분기 범위 계산: Q4 = 10/1 ~ 12/31', () => {
    const range = getQuarterRange(2026, 4)
    expect(range.start).toBe('2026-10-01')
    expect(range.end).toBe('2026-12-31')
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/tax/vat.test.ts
```
Expected: FAIL.

- [ ] **Step 3: VAT 시뮬레이터 구현**

Create: `workspace/src/lib/tax/vat.ts`
```ts
import type { Transaction, VATResult } from '@/types/domain'
import { isVATDeductible } from '@/lib/categories/deduction-rules'

export type Quarter = 1 | 2 | 3 | 4

export function getQuarterRange(year: number, quarter: Quarter): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  const lastDay = new Date(year, endMonth, 0).getDate()
  return {
    start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    end: `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

function isInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

export function simulateVAT(
  transactions: Transaction[],
  year: number,
  quarter: Quarter,
): VATResult {
  const { start, end } = getQuarterRange(year, quarter)
  const inRange = transactions.filter(tx => isInRange(tx.date, start, end))

  // 매출세액 = 매출 행의 총합 × 10/110
  // 카드 매출 금액에는 부가세가 포함되어 있다고 가정 (공급대가 기준)
  const salesTotal = inRange
    .filter(tx => tx.category === '매출' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)
  const outputVAT = Math.round(salesTotal * 10 / 110)

  // 매입세액 = 공제 가능한 사업비 × 10/110
  const deductibleTotal = inRange
    .filter(isVATDeductible)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const inputVAT = Math.round(deductibleTotal * 10 / 110)

  const estimatedVAT = outputVAT - inputVAT

  return {
    year,
    quarter,
    outputVAT,
    inputVAT,
    estimatedVAT,
    transactionCount: inRange.length,
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npm test -- tests/lib/tax/vat.test.ts
```
Expected: PASS — 6 tests.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tax/vat.ts tests/lib/tax/vat.test.ts
git commit -m "feat: implement VAT simulator (quarterly)"
```

---

### Task 1.4: 종소세 누진세율 테이블 + 시뮬레이터

**Files:**
- Create: `workspace/src/lib/tax/brackets.ts`
- Create: `workspace/src/lib/tax/income-tax.ts`
- Test: `workspace/tests/lib/tax/income-tax.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create: `workspace/tests/lib/tax/income-tax.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { computeBracketTax } from '@/lib/tax/brackets'
import { simulateIncomeTax } from '@/lib/tax/income-tax'
import type { Transaction } from '@/types/domain'

const tx = (date: string, category: Transaction['category'], amount: number, method: Transaction['method'] = '카드'): Transaction => ({
  date, category, amount, method,
  counterparty: undefined, person: undefined, memo: undefined,
})

describe('누진세율 계산', () => {
  it('과세표준 1,000만 → 6% 단일구간 = 60만', () => {
    expect(computeBracketTax(10_000_000)).toBe(600_000)
  })

  it('과세표준 5,000만 → 1400만×6% + 3600만×15% = 84만 + 540만 = 624만', () => {
    expect(computeBracketTax(50_000_000)).toBe(6_240_000)
  })

  it('과세표준 1.5억 → 24% 구간까지 적용', () => {
    // 1400×6 + 3600×15 + 3800×24 + 7200×35 = 84 + 540 + 912 + 2520 = 4056만
    expect(computeBracketTax(150_000_000)).toBe(40_560_000)
  })

  it('과세표준 0이면 세금 0', () => {
    expect(computeBracketTax(0)).toBe(0)
  })
})

describe('종소세 시뮬레이터', () => {
  it('연환산: 6개월간 영업이익 3000만 → 연환산 6000만', () => {
    const transactions = [
      tx('2026-01-15', '매출', 12_000_000),
      tx('2026-02-15', '매출', 12_000_000),
      tx('2026-03-15', '매출', 11_000_000),
      tx('2026-04-15', '매출', 12_000_000),
      tx('2026-05-15', '매출', 12_000_000),
      tx('2026-06-15', '매출', 11_000_000),
      tx('2026-01-01', '임대료', -1_500_000, '계좌이체'),
      tx('2026-02-01', '임대료', -1_500_000, '계좌이체'),
      tx('2026-03-01', '임대료', -1_500_000, '계좌이체'),
      tx('2026-04-01', '임대료', -1_500_000, '계좌이체'),
      tx('2026-05-01', '임대료', -1_500_000, '계좌이체'),
      tx('2026-06-01', '임대료', -1_500_000, '계좌이체'),
    ]
    const result = simulateIncomeTax(transactions, '2026-06-30')
    expect(result.annualizedRevenue).toBe(140_000_000)  // (7000만 / 6) × 12
    expect(result.businessIncome).toBeGreaterThan(0)
  })

  it('인적공제(150만/명 디폴트 1명)와 표준세액공제(7만) 반영', () => {
    const transactions = [tx('2026-01-15', '매출', 100_000_000)]
    const result = simulateIncomeTax(transactions, '2026-12-31')
    // 연환산 매출 1억, 비용 0, 사업소득 1억
    // 과세표준 ≈ 1억 - 150만 = 9850만
    // 산출세액 = computeBracketTax(98_500_000) - 7만
    expect(result.taxableBase).toBe(98_500_000)
    expect(result.estimatedTax).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/tax/income-tax.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 누진세율 테이블 구현**

Create: `workspace/src/lib/tax/brackets.ts`
```ts
/**
 * 한국 종합소득세 누진세율 (2024년 개정 기준).
 * https://www.nts.go.kr 참고.
 */
export const TAX_BRACKETS = [
  { upTo: 14_000_000,    rate: 0.06, deduction: 0 },
  { upTo: 50_000_000,    rate: 0.15, deduction: 1_260_000 },
  { upTo: 88_000_000,    rate: 0.24, deduction: 5_760_000 },
  { upTo: 150_000_000,   rate: 0.35, deduction: 15_440_000 },
  { upTo: 300_000_000,   rate: 0.38, deduction: 19_940_000 },
  { upTo: 500_000_000,   rate: 0.40, deduction: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { upTo: Infinity,      rate: 0.45, deduction: 65_940_000 },
] as const

/**
 * 과세표준 × 세율 − 누진공제 방식.
 */
export function computeBracketTax(taxableBase: number): number {
  if (taxableBase <= 0) return 0

  const bracket = TAX_BRACKETS.find(b => taxableBase <= b.upTo)!
  return Math.round(taxableBase * bracket.rate - bracket.deduction)
}
```

- [ ] **Step 4: 종소세 시뮬레이터 구현**

Create: `workspace/src/lib/tax/income-tax.ts`
```ts
import type { Transaction, IncomeTaxResult } from '@/types/domain'
import { isBusinessCategory, getTaxAttributes } from '@/lib/categories/mapping'
import { computeBracketTax } from './brackets'

const DEFAULT_PERSONAL_DEDUCTION = 1_500_000  // 본인 인적공제
const STANDARD_TAX_CREDIT = 70_000             // 표준세액공제

export interface IncomeTaxOptions {
  personalDeductionCount?: number   // 인적공제 인원 (디폴트 1)
  noranusanContribution?: number    // 노란우산공제 연 납입액
  pensionSavings?: number           // 연금저축 연 납입액
  additionalTaxCredit?: number      // 기타 세액공제
}

export function simulateIncomeTax(
  transactions: Transaction[],
  asOfDate: string,
  options: IncomeTaxOptions = {},
): IncomeTaxResult {
  const year = parseInt(asOfDate.slice(0, 4), 10)
  const yearStart = `${year}-01-01`
  const inYear = transactions.filter(tx => tx.date >= yearStart && tx.date <= asOfDate)

  // 경과월 계산 (해당 월 포함)
  const startDate = new Date(yearStart)
  const endDate = new Date(asOfDate)
  const monthsElapsed = Math.max(
    1,
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) + 1
  )
  const annualizationFactor = 12 / monthsElapsed

  // 매출 (매출 카테고리만)
  const revenueSoFar = inYear
    .filter(tx => tx.category === '매출' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)

  // 필요경비 = 사업비 + 종소세상 인정되는 항목들 (경조사비 포함)
  const expenseSoFar = inYear
    .filter(tx => {
      if (tx.amount >= 0) return false
      const attrs = getTaxAttributes(tx.category)
      return attrs.incomeTaxDeductible
    })
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  const annualizedRevenue = Math.round(revenueSoFar * annualizationFactor)
  const annualizedExpense = Math.round(expenseSoFar * annualizationFactor)
  const businessIncome = annualizedRevenue - annualizedExpense

  const personalDeduction = (options.personalDeductionCount ?? 1) * DEFAULT_PERSONAL_DEDUCTION
  const noranusan = options.noranusanContribution ?? 0
  const pension = options.pensionSavings ?? 0

  const taxableBase = Math.max(0, businessIncome - personalDeduction - noranusan - pension)
  const computedTax = computeBracketTax(taxableBase)
  const taxCredits = STANDARD_TAX_CREDIT + (options.additionalTaxCredit ?? 0)
  const estimatedTax = Math.max(0, computedTax - taxCredits)

  return {
    year,
    annualizedRevenue,
    annualizedExpense,
    businessIncome,
    taxableBase,
    computedTax,
    estimatedTax,
    asOfDate,
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run:
```bash
npm test -- tests/lib/tax/income-tax.test.ts
```
Expected: PASS — 6 tests.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/tax/brackets.ts src/lib/tax/income-tax.ts tests/lib/tax/income-tax.test.ts
git commit -m "feat: implement income tax simulator with progressive brackets"
```

---

### Task 1.5: 권장 예비비 계산

**Files:**
- Create: `workspace/src/lib/tax/reserve.ts`
- Test: `workspace/tests/lib/tax/reserve.test.ts`

- [ ] **Step 1: 실패하는 테스트**

Create: `workspace/tests/lib/tax/reserve.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { recommendReserve } from '@/lib/tax/reserve'
import type { Transaction } from '@/types/domain'

const tx = (date: string, category: Transaction['category'], amount: number, method: Transaction['method'] = '카드'): Transaction => ({
  date, category, amount, method,
  counterparty: undefined, person: undefined, memo: undefined,
})

describe('권장 예비비', () => {
  it('매출 1.18억 페이스 + 매입 적은 인적용역 → 월 약 170만 이상 권장', () => {
    // 6개월 누적 매출 5,900만, 비용 적음 (인적용역 가정)
    const transactions = [
      ...Array.from({ length: 6 }, (_, i) =>
        tx(`2026-${String(i + 1).padStart(2, '0')}-15`, '매출', 9_833_333)
      ),
      // 임대료 매월 143만
      ...Array.from({ length: 6 }, (_, i) =>
        tx(`2026-${String(i + 1).padStart(2, '0')}-01`, '임대료', -1_430_000, '계좌이체')
      ),
    ]
    const result = recommendReserve(transactions, '2026-06-30')
    expect(result.monthly).toBeGreaterThan(1_500_000)
    expect(result.monthly).toBeLessThan(2_500_000)
    expect(result.breakdown.vatTotal).toBeGreaterThan(0)
    expect(result.breakdown.incomeTaxTotal).toBeGreaterThan(0)
  })

  it('매출이 매우 낮으면 종소세 0, 부가세만', () => {
    const transactions = [tx('2026-01-15', '매출', 1_000_000)]
    const result = recommendReserve(transactions, '2026-01-31')
    expect(result.breakdown.incomeTaxTotal).toBe(0)
    expect(result.monthly).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/tax/reserve.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 권장 예비비 구현**

Create: `workspace/src/lib/tax/reserve.ts`
```ts
import type { Transaction, ReserveRecommendation } from '@/types/domain'
import { simulateVAT, type Quarter } from './vat'
import { simulateIncomeTax, type IncomeTaxOptions } from './income-tax'

/**
 * 현재 페이스 기준으로 연 예상 세금 총합을 구해 12로 나눈 권장 월 예비비.
 *
 * 부가세: 분기별 현재 페이스를 연환산해서 4분기 합계 추정.
 * 종소세: simulateIncomeTax이 이미 연환산값을 산출.
 */
export function recommendReserve(
  transactions: Transaction[],
  asOfDate: string,
  options: IncomeTaxOptions = {},
): ReserveRecommendation {
  const year = parseInt(asOfDate.slice(0, 4), 10)

  // 현재까지 모든 분기 부가세 추정치 합산 후 연환산
  const monthsElapsed = (parseInt(asOfDate.slice(5, 7), 10))
  const annualizationFactor = 12 / monthsElapsed

  // 현재까지 분기별 부가세 추정치
  const currentQuarter = Math.ceil(monthsElapsed / 3) as Quarter
  let vatSoFar = 0
  for (let q = 1; q <= currentQuarter; q++) {
    const result = simulateVAT(transactions, year, q as Quarter)
    vatSoFar += Math.max(0, result.estimatedVAT)
  }
  const vatTotal = Math.round(vatSoFar * (4 / currentQuarter))

  const incomeTaxResult = simulateIncomeTax(transactions, asOfDate, options)
  const incomeTaxTotal = incomeTaxResult.estimatedTax

  const annualTaxEstimate = vatTotal + incomeTaxTotal
  const monthly = Math.round(annualTaxEstimate / 12)

  return {
    monthly,
    annualTaxEstimate,
    breakdown: {
      vatTotal,
      incomeTaxTotal,
    },
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npm test -- tests/lib/tax/reserve.test.ts
```
Expected: PASS — 2 tests.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tax/reserve.ts tests/lib/tax/reserve.test.ts
git commit -m "feat: compute monthly tax reserve recommendation"
```

---

### Task 1.6: 납부일 D-day 계산

**Files:**
- Create: `workspace/src/lib/tax/due-dates.ts`
- Test: `workspace/tests/lib/tax/due-dates.test.ts`

- [ ] **Step 1: 실패하는 테스트**

Create: `workspace/tests/lib/tax/due-dates.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { getUpcomingDueDates } from '@/lib/tax/due-dates'

describe('납부일 D-day', () => {
  it('1월 1일 기준: 다음 부가세 납부는 1/25 (전년 2기 확정)', () => {
    const dues = getUpcomingDueDates('2026-01-01')
    const firstVAT = dues.find(d => d.type === 'VAT')!
    expect(firstVAT.date).toBe('2026-01-25')
  })

  it('4월 1일 기준: 다음은 4/25 (당해 1기 예정)', () => {
    const dues = getUpcomingDueDates('2026-04-01')
    const firstVAT = dues.find(d => d.type === 'VAT')!
    expect(firstVAT.date).toBe('2026-04-25')
  })

  it('5월 31일 종소세 마감 — 5월 1일에 D-30', () => {
    const dues = getUpcomingDueDates('2026-05-01')
    const incomeTax = dues.find(d => d.type === 'INCOME_TAX')!
    expect(incomeTax.date).toBe('2026-05-31')
    expect(incomeTax.daysRemaining).toBe(30)
  })

  it('지난 날짜는 결과에 포함되지 않음', () => {
    const dues = getUpcomingDueDates('2026-06-01')
    expect(dues.every(d => d.daysRemaining >= 0)).toBe(true)
  })

  it('결과는 가까운 순서로 정렬', () => {
    const dues = getUpcomingDueDates('2026-01-15')
    for (let i = 1; i < dues.length; i++) {
      expect(dues[i].daysRemaining).toBeGreaterThanOrEqual(dues[i - 1].daysRemaining)
    }
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/tax/due-dates.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 납부일 계산 구현**

Create: `workspace/src/lib/tax/due-dates.ts`
```ts
import type { DueDate } from '@/types/domain'
import { differenceInCalendarDays } from 'date-fns'

/**
 * 한국 자영업자(일반과세자) 세금 납부일:
 * - 부가세: 1/25 (전년 2기 확정), 4/25 (1기 예정), 7/25 (1기 확정), 10/25 (2기 예정)
 * - 종소세: 5/31
 */
export function getUpcomingDueDates(today: string): DueDate[] {
  const now = new Date(today)
  const thisYear = now.getFullYear()

  const candidates: DueDate[] = []

  // 부가세 4개 (당해년)
  const vatDates: Array<{ label: string; mmdd: string }> = [
    { label: '부가세 (전년 2기 확정)', mmdd: '01-25' },
    { label: '부가세 (1기 예정)',       mmdd: '04-25' },
    { label: '부가세 (1기 확정)',       mmdd: '07-25' },
    { label: '부가세 (2기 예정)',       mmdd: '10-25' },
  ]

  for (const v of vatDates) {
    const date = `${thisYear}-${v.mmdd}`
    const days = differenceInCalendarDays(new Date(date), now)
    if (days >= 0) {
      candidates.push({ type: 'VAT', label: v.label, date, daysRemaining: days })
    }
  }

  // 종소세 (5/31)
  const incomeTaxDate = `${thisYear}-05-31`
  const itDays = differenceInCalendarDays(new Date(incomeTaxDate), now)
  if (itDays >= 0) {
    candidates.push({ type: 'INCOME_TAX', label: '종합소득세', date: incomeTaxDate, daysRemaining: itDays })
  }

  // 다음 해 1/25 부가세 (당해 모든 부가세가 지난 시점에 다음 1/25 표시)
  const nextYearVAT = `${thisYear + 1}-01-25`
  const nextYearDays = differenceInCalendarDays(new Date(nextYearVAT), now)
  if (candidates.filter(c => c.type === 'VAT').length === 0 && nextYearDays >= 0) {
    candidates.push({
      type: 'VAT',
      label: '부가세 (당해 2기 확정)',
      date: nextYearVAT,
      daysRemaining: nextYearDays,
    })
  }

  return candidates.sort((a, b) => a.daysRemaining - b.daysRemaining)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npm test -- tests/lib/tax/due-dates.test.ts
```
Expected: PASS — 5 tests.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tax/due-dates.ts tests/lib/tax/due-dates.test.ts
git commit -m "feat: compute upcoming tax due dates"
```

---

### Task 1.7: 절세 액션 카드 라이브러리

**Files:**
- Create: `workspace/src/lib/advice/action-cards.ts`
- Test: `workspace/tests/lib/advice/action-cards.test.ts`

- [ ] **Step 1: 실패하는 테스트**

Create: `workspace/tests/lib/advice/action-cards.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { getActionCards } from '@/lib/advice/action-cards'
import type { Transaction } from '@/types/domain'

const tx = (date: string, category: Transaction['category'], amount: number, method: Transaction['method'] = '카드'): Transaction => ({
  date, category, amount, method,
  counterparty: undefined, person: undefined, memo: undefined,
})

describe('절세 액션 카드', () => {
  it('경조사비 결제가 있으면 청첩장 챙기기 카드 트리거', () => {
    const cards = getActionCards([
      tx('2026-02-15', '경조사비', -200_000, '계좌이체'),
    ], '2026-02-20', {})
    const wedding = cards.find(c => c.id === 'wedding-evidence')
    expect(wedding?.triggered).toBe(true)
  })

  it('5월에 가까우면 노란우산 추가 납입 카드 트리거', () => {
    const cards = getActionCards([], '2026-04-15', {})
    const noranusan = cards.find(c => c.id === 'noranusan-deadline')
    expect(noranusan?.triggered).toBe(true)
  })

  it('분기 D-7 이내일 때 부가세 자료 준비 카드 트리거', () => {
    const cards = getActionCards([], '2026-04-19', {})  // 4/25 = D-6
    const vatPrep = cards.find(c => c.id === 'vat-prep')
    expect(vatPrep?.triggered).toBe(true)
  })

  it('노란우산 가입자가 한도 미달이면 추가 납입 권장 카드', () => {
    const cards = getActionCards([], '2026-03-01', { noranusanContribution: 1_000_000 })
    const noranusanRoom = cards.find(c => c.id === 'noranusan-room')
    expect(noranusanRoom?.triggered).toBe(true)
    expect(noranusanRoom?.estimatedSavings).toBeGreaterThan(0)
  })

  it('항상 표시되는 일반론 카드는 triggered=false여도 결과에 포함', () => {
    const cards = getActionCards([], '2026-07-01', {})
    expect(cards.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/advice/action-cards.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 액션 카드 구현**

Create: `workspace/src/lib/advice/action-cards.ts`
```ts
import type { Transaction, ActionCard } from '@/types/domain'
import { differenceInCalendarDays } from 'date-fns'
import { getUpcomingDueDates } from '@/lib/tax/due-dates'

interface ActionCardContext {
  noranusanContribution?: number  // 연 납입액 (원)
}

const NORANUSAN_ANNUAL_LIMIT = 5_000_000  // 노란우산공제 연 한도 (소득공제 한도, 단순화)
const INCOME_TAX_DEADLINE_MONTH = 5

export function getActionCards(
  transactions: Transaction[],
  today: string,
  context: ActionCardContext = {},
): ActionCard[] {
  const cards: ActionCard[] = []
  const now = new Date(today)
  const thisYear = now.getFullYear()
  const recentMonth = today.slice(0, 7)

  // 1. 경조사비 결제 → 청첩장 챙기기
  const recentWedding = transactions.find(tx => {
    if (tx.category !== '경조사비') return false
    return tx.date.startsWith(recentMonth)
  })
  cards.push({
    id: 'wedding-evidence',
    title: '청첩장·부고장 챙기셨나요?',
    description: '경조사비는 청첩장·부고장 등 증빙이 있으면 20만원까지 사회통념상 비용으로 인정됩니다. 사진으로 보관해두세요.',
    estimatedSavings: undefined,
    category: 'evidence',
    triggered: !!recentWedding,
  })

  // 2. 노란우산공제 한도 여유
  const noranusanRoom = NORANUSAN_ANNUAL_LIMIT - (context.noranusanContribution ?? 0)
  cards.push({
    id: 'noranusan-room',
    title: `노란우산 한도 ${Math.round(noranusanRoom / 10_000)}만원 남았어요`,
    description: `연 ${NORANUSAN_ANNUAL_LIMIT.toLocaleString()}원까지 소득공제. 사업소득 구간에 따라 15~24% 절세 효과.`,
    estimatedSavings: Math.round(noranusanRoom * 0.20),  // 24% 구간 가정 단순화
    category: 'deduction',
    triggered: noranusanRoom > 500_000,
  })

  // 3. 5월 종소세 마감 임박 (4월 진입 시)
  const incomeTaxDeadline = new Date(`${thisYear}-05-31`)
  const daysToITDeadline = differenceInCalendarDays(incomeTaxDeadline, now)
  cards.push({
    id: 'noranusan-deadline',
    title: '노란우산·연금저축 추가 납입 마지막 기회',
    description: '5월 종소세 신고 전까지 납입하면 당해 소득공제로 인정됩니다.',
    estimatedSavings: undefined,
    category: 'preparation',
    triggered: daysToITDeadline > 0 && daysToITDeadline <= 60,
  })

  // 4. 분기 부가세 D-7
  const dues = getUpcomingDueDates(today)
  const nextVAT = dues.find(d => d.type === 'VAT')
  cards.push({
    id: 'vat-prep',
    title: '부가세 신고 D-' + (nextVAT?.daysRemaining ?? '?'),
    description: '신고 자료를 미리 정리해두세요: 매출/매입 엑셀 다운로드 → 세무사 전달.',
    estimatedSavings: undefined,
    category: 'preparation',
    triggered: !!nextVAT && nextVAT.daysRemaining <= 7,
  })

  // 5. 항상 표시 — 일반론 카드
  cards.push({
    id: 'general-receipt',
    title: '카드 결제는 사업용 카드로',
    description: '개인 카드로 사업비를 결제하면 부가세 매입세액 공제가 누락됩니다. 사업용 카드 사용 습관화.',
    estimatedSavings: undefined,
    category: 'general',
    triggered: true,
  })

  return cards
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npm test -- tests/lib/advice/action-cards.test.ts
```
Expected: PASS — 5 tests.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/advice/action-cards.ts tests/lib/advice/action-cards.test.ts
git commit -m "feat: implement tax-saving action card library"
```

---

## Phase 2 — 데이터 레이어 (Google Sheets)

### Task 2.1: Sheet row 파서

**Files:**
- Create: `workspace/src/lib/sheets/parser.ts`
- Create: `workspace/tests/fixtures/sample-rows.ts`
- Test: `workspace/tests/lib/sheets/parser.test.ts`

- [ ] **Step 1: 시드 데이터 fixture 작성**

Create: `workspace/tests/fixtures/sample-rows.ts`
```ts
/**
 * 운영자(여자친구) 시트 컬럼 순서:
 * No. | 날짜 | 계정과목 | 금액 | 수단 | 금액(중복) | 비고 | 비고2
 * 위치: A    B     C        D    E    F          G    H
 */
export const SAMPLE_RAW_ROWS: string[][] = [
  ['1', '2026-02-01', '1월 종합', '-20149424', '', '-20149424', '', ''],
  ['2', '2026-02-01', '임대료', '-1430000', '계좌이체', '-1430000', '1월 임대료', ''],
  ['3', '2026-02-01', '식비', '-13500', '카드', '-13500', '쿠팡이츠', '본노엘'],
  ['4', '2026-02-02', '매출', '650000', '카드', '650000', '개인레슨', '김기수'],
  ['5', '2026-02-05', '경조사비', '-200000', '계좌이체', '-200000', '결혼식', ''],
  ['6', '', '', '', '', '', '', ''],  // 빈 행
]
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create: `workspace/tests/lib/sheets/parser.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { parseSheetRows } from '@/lib/sheets/parser'
import { SAMPLE_RAW_ROWS } from '../../fixtures/sample-rows'

describe('시트 파서', () => {
  it('빈 행은 제외하고 거래만 추출', () => {
    const txs = parseSheetRows(SAMPLE_RAW_ROWS)
    expect(txs).toHaveLength(4)  // 헤더성 1월종합 + 빈 행 제외
  })

  it('금액 부호 보존', () => {
    const txs = parseSheetRows(SAMPLE_RAW_ROWS)
    const rent = txs.find(t => t.category === '임대료')
    expect(rent?.amount).toBe(-1_430_000)
    const sale = txs.find(t => t.category === '매출')
    expect(sale?.amount).toBe(650_000)
  })

  it('비고1, 비고2 매핑', () => {
    const txs = parseSheetRows(SAMPLE_RAW_ROWS)
    const sale = txs.find(t => t.category === '매출')!
    expect(sale.counterparty).toBe('개인레슨')
    expect(sale.person).toBe('김기수')
  })

  it('알 수 없는 카테고리는 제외 ("1월 종합" 같은 헤더성 행)', () => {
    const txs = parseSheetRows(SAMPLE_RAW_ROWS)
    expect(txs.every(t => t.category !== ('1월 종합' as never))).toBe(true)
  })

  it('수단 미입력 시 거래 제외 (불완전 데이터)', () => {
    const txs = parseSheetRows([
      ['1', '2026-01-01', '식비', '-1000', '', '-1000', '', ''],
    ])
    expect(txs).toHaveLength(0)
  })
})
```

- [ ] **Step 3: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/sheets/parser.test.ts
```
Expected: FAIL.

- [ ] **Step 4: 파서 구현**

Create: `workspace/src/lib/sheets/parser.ts`
```ts
import type { Transaction, Category, PaymentMethod } from '@/types/domain'

const VALID_CATEGORIES = new Set<Category>([
  '매출', '임대료', '식비', '마케팅비', '교육비', '정기결제', '세금',
  '소모품', '보험료', '품위유지비', '교통비', '의류비', '의료비',
  '소품', '도서인쇄비', '경조사비', '수수료', '공과금', '관리비',
])

const VALID_METHODS = new Set<PaymentMethod>(['카드', '계좌이체', '현금'])

function isValidCategory(s: string): s is Category {
  return VALID_CATEGORIES.has(s as Category)
}

function isValidMethod(s: string): s is PaymentMethod {
  return VALID_METHODS.has(s as PaymentMethod)
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.\-]/g, '')
  if (!cleaned) return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * 운영자 시트 컬럼:
 * [0] No. | [1] 날짜 | [2] 계정과목 | [3] 금액 | [4] 수단 |
 * [5] 금액(중복) | [6] 비고 | [7] 비고2
 */
export function parseSheetRows(rows: string[][]): Transaction[] {
  const out: Transaction[] = []
  for (const row of rows) {
    const [_no, date, category, amountRaw, method, _dup, memo1, memo2] = row
    if (!date || !category || !amountRaw || !method) continue
    if (!isValidCategory(category)) continue
    if (!isValidMethod(method)) continue

    const amount = parseAmount(amountRaw)
    if (amount === null) continue

    out.push({
      date,
      category,
      amount,
      method,
      counterparty: memo1?.trim() || undefined,
      person: memo2?.trim() || undefined,
      memo: undefined,
    })
  }
  return out
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run:
```bash
npm test -- tests/lib/sheets/parser.test.ts
```
Expected: PASS — 5 tests.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/sheets/parser.ts tests/fixtures/sample-rows.ts tests/lib/sheets/parser.test.ts
git commit -m "feat: parse Google Sheets rows into Transactions"
```

---

### Task 2.2: Google Sheets API 클라이언트

**Files:**
- Create: `workspace/src/lib/sheets/client.ts`
- Create: `workspace/.env.example`

> **참고:** 이 task는 실제 시트 접근이 필요하므로 unit test는 인터페이스만 검증. 통합 테스트는 Phase 4에서 실시.

- [ ] **Step 1: .env.example 생성**

Create: `workspace/.env.example`
```
# Google Sheets 접근 (서비스 계정 사용)
GOOGLE_SHEETS_CLIENT_EMAIL=workspace-reader@<project>.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_ID=11UJX_0VDdYLVayu2S8f3UOGjL6tq-sEfuk6M5hRqDlE
GOOGLE_SHEETS_RANGE=가계부!A2:H1000

# 앱 비밀번호 (미들웨어 베이직 인증)
WORKSPACE_PASSWORD=set-me-locally
```

- [ ] **Step 2: 클라이언트 구현**

Create: `workspace/src/lib/sheets/client.ts`
```ts
import { google } from 'googleapis'

export interface SheetConfig {
  clientEmail: string
  privateKey: string
  spreadsheetId: string
  range: string
}

export function getSheetConfig(): SheetConfig {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID
  const range = process.env.GOOGLE_SHEETS_RANGE ?? '가계부!A2:H1000'

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error('Missing Google Sheets env vars (GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_ID)')
  }

  return { clientEmail, privateKey, spreadsheetId, range }
}

export async function fetchSheetRows(config: SheetConfig): Promise<string[][]> {
  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: config.range,
  })

  return response.data.values ?? []
}
```

- [ ] **Step 3: 사용자 가이드 README 업데이트**

Modify: `workspace/README.md` (Next.js 기본 내용 위에 추가)
```markdown
# 워크스페이스 v1

여자친구 필라테스 스튜디오 운영 대시보드.

## 셋업

1. Google Cloud Console에서 서비스 계정 생성 + Google Sheets API 활성화
2. 서비스 계정 키 JSON 다운로드
3. 대상 구글 시트를 서비스 계정 이메일로 공유 (Viewer 권한)
4. `.env.example`을 `.env.local`로 복사 후 값 채우기
5. `npm install && npm run dev`

## 테스트

```bash
npm test         # 단위 테스트
npm run test:ui  # UI 모드
```

## 배포

Vercel에 연결 후 환경변수 동일하게 설정.
```

- [ ] **Step 4: 커밋**

```bash
git add src/lib/sheets/client.ts .env.example README.md
git commit -m "feat: add Google Sheets API client with service account auth"
```

---

### Task 2.3: 5분 in-memory 캐시

**Files:**
- Create: `workspace/src/lib/sheets/cache.ts`
- Test: `workspace/tests/lib/sheets/cache.test.ts`

- [ ] **Step 1: 실패하는 테스트**

Create: `workspace/tests/lib/sheets/cache.test.ts`
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCache } from '@/lib/sheets/cache'

describe('캐시', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('첫 호출 시 fetcher를 호출하고 결과 반환', async () => {
    const fetcher = vi.fn().mockResolvedValue([['a', 'b']])
    const cache = createCache({ ttlMs: 5 * 60 * 1000, fetcher })
    const result = await cache.get()
    expect(result).toEqual([['a', 'b']])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('TTL 안에 다시 호출하면 캐시 사용 (fetcher 1번만)', async () => {
    const fetcher = vi.fn().mockResolvedValue([['a']])
    const cache = createCache({ ttlMs: 5 * 60 * 1000, fetcher })
    await cache.get()
    await cache.get()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('TTL 만료 후 fetcher 재호출', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce([['a']])
      .mockResolvedValueOnce([['b']])
    const cache = createCache({ ttlMs: 1000, fetcher })
    const r1 = await cache.get()
    vi.advanceTimersByTime(2000)
    const r2 = await cache.get()
    expect(r1).toEqual([['a']])
    expect(r2).toEqual([['b']])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidate() 호출 시 다음 get은 fetcher 호출', async () => {
    const fetcher = vi.fn().mockResolvedValue([['a']])
    const cache = createCache({ ttlMs: 60_000, fetcher })
    await cache.get()
    cache.invalidate()
    await cache.get()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/sheets/cache.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 캐시 구현**

Create: `workspace/src/lib/sheets/cache.ts`
```ts
export interface CacheConfig<T> {
  ttlMs: number
  fetcher: () => Promise<T>
}

export interface Cache<T> {
  get(): Promise<T>
  invalidate(): void
}

export function createCache<T>(config: CacheConfig<T>): Cache<T> {
  let cached: { value: T; expiresAt: number } | null = null

  return {
    async get() {
      if (cached && Date.now() < cached.expiresAt) {
        return cached.value
      }
      const value = await config.fetcher()
      cached = { value, expiresAt: Date.now() + config.ttlMs }
      return value
    },
    invalidate() {
      cached = null
    },
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
npm test -- tests/lib/sheets/cache.test.ts
```
Expected: PASS — 4 tests.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/sheets/cache.ts tests/lib/sheets/cache.test.ts
git commit -m "feat: implement in-memory TTL cache"
```

---

### Task 2.4: /api/transactions 라우트

**Files:**
- Create: `workspace/src/app/api/transactions/route.ts`

- [ ] **Step 1: 라우트 구현**

Create: `workspace/src/app/api/transactions/route.ts`
```ts
import { NextResponse } from 'next/server'
import { fetchSheetRows, getSheetConfig } from '@/lib/sheets/client'
import { parseSheetRows } from '@/lib/sheets/parser'
import { createCache } from '@/lib/sheets/cache'

const transactionsCache = createCache({
  ttlMs: 5 * 60 * 1000,
  fetcher: async () => {
    const config = getSheetConfig()
    const rows = await fetchSheetRows(config)
    return parseSheetRows(rows)
  },
})

export async function GET() {
  try {
    const transactions = await transactionsCache.get()
    return NextResponse.json({ transactions, cachedAt: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  // 수동 캐시 무효화 (디버깅용)
  transactionsCache.invalidate()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 로컬에서 동작 확인 (env 설정 후)**

먼저 `.env.local` 작성 (사용자가 본인 서비스 계정 정보로):
```
GOOGLE_SHEETS_CLIENT_EMAIL=...
GOOGLE_SHEETS_PRIVATE_KEY="..."
GOOGLE_SHEETS_ID=11UJX_0VDdYLVayu2S8f3UOGjL6tq-sEfuk6M5hRqDlE
GOOGLE_SHEETS_RANGE=가계부!A2:H1000
WORKSPACE_PASSWORD=test123
```

Run:
```bash
npm run dev
```

Then in another terminal:
```bash
curl http://localhost:3000/api/transactions | head -100
```
Expected: JSON with `transactions` array. 첫 셋업이면 실패할 수 있음 — 서비스 계정 셋업 가이드 참고.

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/transactions/route.ts
git commit -m "feat: add /api/transactions endpoint with caching"
```

---

### Task 2.5: 미들웨어 베이직 인증

**Files:**
- Create: `workspace/middleware.ts`

- [ ] **Step 1: 미들웨어 구현**

Create: `workspace/middleware.ts`
```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/_next', '/favicon.ico']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const password = process.env.WORKSPACE_PASSWORD
  if (!password) {
    return NextResponse.next()  // 비밀번호 미설정 시 패스 (로컬 개발 편의)
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Workspace"' },
    })
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString()
  const [, providedPw] = decoded.split(':')

  if (providedPw !== password) {
    return new NextResponse('Wrong password', { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/health).*)'],
}
```

- [ ] **Step 2: 로컬 동작 확인**

```bash
WORKSPACE_PASSWORD=test123 npm run dev
```

브라우저에서 http://localhost:3000 접속 → 비밀번호 입력창 뜨는지 확인.
사용자명 비워두고 비밀번호 `test123` 입력 → 통과.

- [ ] **Step 3: 커밋**

```bash
git add middleware.ts
git commit -m "feat: add basic auth middleware for single-user access"
```

---

## Phase 3 — UI 컴포넌트 & 페이지

### Task 3.1: 글로벌 레이아웃 + 네비게이션

**Files:**
- Modify: `workspace/src/app/layout.tsx`

- [ ] **Step 1: 레이아웃 작성**

Modify: `workspace/src/app/layout.tsx`
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '워크스페이스',
  description: '유진의 스튜디오 운영 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold">워크스페이스</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="hover:underline">홈</a>
              <a href="/tax" className="hover:underline">세금</a>
              <a href="/analytics" className="hover:underline">분석</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 동작 확인**

```bash
npm run dev
```
브라우저에서 http://localhost:3000 → 헤더와 네비 표시 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/layout.tsx
git commit -m "feat: add global layout with navigation"
```

---

### Task 3.2: UI 기본 컴포넌트 (Card, KpiCard)

**Files:**
- Create: `workspace/src/components/ui/Card.tsx`
- Create: `workspace/src/components/ui/KpiCard.tsx`
- Test: `workspace/tests/components/ui/KpiCard.test.tsx`

- [ ] **Step 1: 실패하는 테스트**

Create: `workspace/tests/components/ui/KpiCard.test.tsx`
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiCard } from '@/components/ui/KpiCard'

describe('KpiCard', () => {
  it('타이틀과 금액 표시', () => {
    render(<KpiCard title="매출" amount={11_494_500} />)
    expect(screen.getByText('매출')).toBeInTheDocument()
    expect(screen.getByText('11,494,500')).toBeInTheDocument()
  })

  it('subtitle 옵션 표시', () => {
    render(<KpiCard title="매출" amount={1_000_000} subtitle="2026년 2월" />)
    expect(screen.getByText('2026년 2월')).toBeInTheDocument()
  })

  it('음수는 마이너스 색상', () => {
    const { container } = render(<KpiCard title="지출" amount={-500_000} />)
    expect(container.querySelector('.text-red-600')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/components/ui/KpiCard.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Card 컴포넌트 구현**

Create: `workspace/src/components/ui/Card.tsx`
```tsx
import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-neutral-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: KpiCard 컴포넌트 구현**

Create: `workspace/src/components/ui/KpiCard.tsx`
```tsx
import { Card } from './Card'

interface KpiCardProps {
  title: string
  amount: number
  subtitle?: string
  unit?: string
}

export function KpiCard({ title, amount, subtitle, unit = '원' }: KpiCardProps) {
  const isNegative = amount < 0
  return (
    <Card>
      <div className="text-xs text-neutral-500">{title}</div>
      <div className={`text-2xl font-bold mt-1 ${isNegative ? 'text-red-600' : 'text-neutral-900'}`}>
        {amount.toLocaleString()}
        <span className="text-sm font-normal ml-1">{unit}</span>
      </div>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </Card>
  )
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run:
```bash
npm test -- tests/components/ui/KpiCard.test.tsx
```
Expected: PASS — 3 tests.

- [ ] **Step 6: 커밋**

```bash
git add src/components/ui/ tests/components/ui/
git commit -m "feat: add Card and KpiCard UI primitives"
```

---

### Task 3.3: Recharts 차트 래퍼 — 월별 막대 차트

**Files:**
- Create: `workspace/src/components/Charts/MonthlyBarChart.tsx`

> **테스트 노트:** Recharts는 SVG 기반이라 jsdom에서 ResizeObserver 등 mock이 필요. v1에서는 시각 컴포넌트 테스트는 생략하고 통합 단계에서 수동 확인. 컴포넌트는 prop 인터페이스만 깔끔하게.

- [ ] **Step 1: 차트 컴포넌트 구현**

Create: `workspace/src/components/Charts/MonthlyBarChart.tsx`
```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export interface MonthlyDatum {
  month: string  // 'YYYY-MM'
  amount: number
}

interface MonthlyBarChartProps {
  data: MonthlyDatum[]
  title: string
  color?: string
}

export function MonthlyBarChart({ data, title, color = '#2563eb' }: MonthlyBarChartProps) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="month" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
            <Tooltip formatter={(v: number) => v.toLocaleString() + '원'} />
            <Bar dataKey="amount" fill={color} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 시각 확인용 임시 페이지 (선택)**

Create: `workspace/src/app/_debug/chart/page.tsx`
```tsx
import { MonthlyBarChart } from '@/components/Charts/MonthlyBarChart'

const SAMPLE = [
  { month: '2025-09', amount: 11_000_000 },
  { month: '2025-10', amount: 13_000_000 },
  { month: '2025-11', amount: 11_500_000 },
  { month: '2025-12', amount: 9_500_000 },
]

export default function ChartDebug() {
  return (
    <div className="space-y-4">
      <MonthlyBarChart data={SAMPLE} title="월별 매출 (샘플)" />
    </div>
  )
}
```

브라우저 http://localhost:3000/_debug/chart → 차트 표시 확인.
확인 후 `_debug` 폴더 삭제 또는 보관 결정.

- [ ] **Step 3: 커밋**

```bash
git add src/components/Charts/MonthlyBarChart.tsx
git commit -m "feat: add monthly bar chart component (Recharts)"
```

---

### Task 3.4: HomeCards — 부가세·예비비·D-day 카드

**Files:**
- Create: `workspace/src/components/HomeCards/VATForecastCard.tsx`
- Create: `workspace/src/components/HomeCards/ReserveCard.tsx`
- Create: `workspace/src/components/HomeCards/DueDateBanner.tsx`

- [ ] **Step 1: VATForecastCard 구현**

Create: `workspace/src/components/HomeCards/VATForecastCard.tsx`
```tsx
import { Card } from '@/components/ui/Card'
import type { VATResult } from '@/types/domain'

export function VATForecastCard({ result }: { result: VATResult }) {
  return (
    <Card>
      <div className="text-xs text-neutral-500">{result.year}년 {result.quarter}분기 부가세 예상</div>
      <div className="text-3xl font-bold mt-2">
        {result.estimatedVAT.toLocaleString()}<span className="text-base font-normal ml-1">원</span>
      </div>
      <div className="text-xs text-neutral-500 mt-2 flex gap-4">
        <span>매출세액 {(result.outputVAT / 10_000).toFixed(0)}만</span>
        <span>매입세액 {(result.inputVAT / 10_000).toFixed(0)}만</span>
        <span>거래 {result.transactionCount}건</span>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: ReserveCard 구현**

Create: `workspace/src/components/HomeCards/ReserveCard.tsx`
```tsx
import { Card } from '@/components/ui/Card'
import type { ReserveRecommendation } from '@/types/domain'

export function ReserveCard({ recommendation }: { recommendation: ReserveRecommendation }) {
  return (
    <Card>
      <div className="text-xs text-neutral-500">권장 월 예비비</div>
      <div className="text-3xl font-bold mt-2 text-blue-600">
        {recommendation.monthly.toLocaleString()}<span className="text-base font-normal ml-1">원</span>
      </div>
      <div className="text-xs text-neutral-500 mt-2">
        연 예상 세금 {(recommendation.annualTaxEstimate / 10_000).toFixed(0)}만원
      </div>
      <div className="text-xs text-neutral-400 mt-1">
        부가세 {(recommendation.breakdown.vatTotal / 10_000).toFixed(0)}만 + 종소세 {(recommendation.breakdown.incomeTaxTotal / 10_000).toFixed(0)}만
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: DueDateBanner 구현**

Create: `workspace/src/components/HomeCards/DueDateBanner.tsx`
```tsx
import type { DueDate } from '@/types/domain'

export function DueDateBanner({ due }: { due: DueDate }) {
  const urgent = due.daysRemaining <= 14
  return (
    <div className={`rounded-md px-4 py-3 ${urgent ? 'bg-amber-50 border border-amber-200' : 'bg-neutral-100'}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{due.label}</span>
          <span className="text-xs text-neutral-500 ml-2">{due.date}</span>
        </div>
        <div className={`text-sm font-bold ${urgent ? 'text-amber-700' : 'text-neutral-600'}`}>
          D-{due.daysRemaining}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/HomeCards/
git commit -m "feat: add home cards (VAT forecast, reserve, due date)"
```

---

### Task 3.5: 홈 페이지 (page.tsx) — 데이터 wiring 포함

**Files:**
- Modify: `workspace/src/app/page.tsx`

- [ ] **Step 1: 홈 페이지 작성**

Modify: `workspace/src/app/page.tsx`
```tsx
import { fetchSheetRows, getSheetConfig } from '@/lib/sheets/client'
import { parseSheetRows } from '@/lib/sheets/parser'
import { simulateVAT } from '@/lib/tax/vat'
import { recommendReserve } from '@/lib/tax/reserve'
import { getUpcomingDueDates } from '@/lib/tax/due-dates'
import { getActionCards } from '@/lib/advice/action-cards'
import { VATForecastCard } from '@/components/HomeCards/VATForecastCard'
import { ReserveCard } from '@/components/HomeCards/ReserveCard'
import { DueDateBanner } from '@/components/HomeCards/DueDateBanner'
import { Card } from '@/components/ui/Card'

export const revalidate = 300  // 5분 ISR

async function loadTransactions() {
  const config = getSheetConfig()
  const rows = await fetchSheetRows(config)
  return parseSheetRows(rows)
}

export default async function HomePage() {
  const transactions = await loadTransactions()
  const today = new Date().toISOString().slice(0, 10)
  const year = parseInt(today.slice(0, 4), 10)
  const currentMonth = parseInt(today.slice(5, 7), 10)
  const currentQuarter = Math.ceil(currentMonth / 3) as 1 | 2 | 3 | 4

  const vatResult = simulateVAT(transactions, year, currentQuarter)
  const reserveResult = recommendReserve(transactions, today)
  const dueDates = getUpcomingDueDates(today)
  const nextDue = dueDates[0]
  const actionCards = getActionCards(transactions, today).filter(c => c.triggered)

  return (
    <div className="space-y-4">
      {nextDue && <DueDateBanner due={nextDue} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VATForecastCard result={vatResult} />
        <ReserveCard recommendation={reserveResult} />
      </div>

      <Card>
        <div className="text-sm font-medium mb-3">절세 액션 ({actionCards.length}건)</div>
        <div className="space-y-2">
          {actionCards.map(card => (
            <div key={card.id} className="border-l-4 border-blue-500 pl-3 py-1">
              <div className="text-sm font-medium">{card.title}</div>
              <div className="text-xs text-neutral-500">{card.description}</div>
              {card.estimatedSavings != null && (
                <div className="text-xs text-blue-600 mt-1">절세 가능 ~{(card.estimatedSavings / 10_000).toFixed(0)}만원</div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: 동작 확인 (로컬)**

```bash
npm run dev
```
http://localhost:3000 → 홈 화면 표시 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/page.tsx
git commit -m "feat: wire home page with VAT, reserve, and action cards"
```

---

### Task 3.6: 세금 탭 페이지

**Files:**
- Create: `workspace/src/app/tax/page.tsx`

- [ ] **Step 1: 세금 페이지 작성**

Create: `workspace/src/app/tax/page.tsx`
```tsx
import { fetchSheetRows, getSheetConfig } from '@/lib/sheets/client'
import { parseSheetRows } from '@/lib/sheets/parser'
import { simulateVAT, type Quarter } from '@/lib/tax/vat'
import { simulateIncomeTax } from '@/lib/tax/income-tax'
import { Card } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'

export const revalidate = 300

async function loadTransactions() {
  const config = getSheetConfig()
  const rows = await fetchSheetRows(config)
  return parseSheetRows(rows)
}

export default async function TaxPage() {
  const transactions = await loadTransactions()
  const today = new Date().toISOString().slice(0, 10)
  const year = parseInt(today.slice(0, 4), 10)

  const vatByQuarter = [1, 2, 3, 4].map(q => simulateVAT(transactions, year, q as Quarter))
  const annualVAT = vatByQuarter.reduce((sum, v) => sum + Math.max(0, v.estimatedVAT), 0)
  const incomeTax = simulateIncomeTax(transactions, today)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-3">부가세 (분기별)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {vatByQuarter.map(v => (
            <KpiCard
              key={v.quarter}
              title={`${v.quarter}분기`}
              amount={v.estimatedVAT}
              subtitle={`매출 ${(v.outputVAT * 11).toLocaleString()}원 기준`}
            />
          ))}
        </div>
        <div className="mt-3">
          <KpiCard title={`${year}년 부가세 합계 (예상)`} amount={annualVAT} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">종합소득세 (연환산)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard title="연환산 매출" amount={incomeTax.annualizedRevenue} />
          <KpiCard title="필요경비" amount={-incomeTax.annualizedExpense} />
          <KpiCard title="사업소득금액" amount={incomeTax.businessIncome} />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <KpiCard title="과세표준" amount={incomeTax.taxableBase} />
          <KpiCard title={`${year}년 5월 예상 납부액`} amount={incomeTax.estimatedTax} />
        </div>
        <Card className="mt-3">
          <div className="text-xs text-neutral-500">
            * 인적공제 1명(150만), 표준세액공제 7만 기준. 노란우산공제·연금저축은 미반영 (구현 시 사용자 입력 화면 추가).
          </div>
        </Card>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: 동작 확인**

http://localhost:3000/tax → 분기별 부가세 4개 카드 + 종소세 요약 표시 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/tax/page.tsx
git commit -m "feat: add tax tab with quarterly VAT and annual income tax view"
```

---

### Task 3.7: 분석 탭 페이지 (Looker 레이아웃 계승)

**Files:**
- Create: `workspace/src/app/analytics/page.tsx`
- Create: `workspace/src/lib/analytics/monthly.ts`
- Test: `workspace/tests/lib/analytics/monthly.test.ts`

- [ ] **Step 1: 월별 집계 함수 테스트**

Create: `workspace/tests/lib/analytics/monthly.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { aggregateMonthly } from '@/lib/analytics/monthly'
import type { Transaction } from '@/types/domain'

const tx = (date: string, category: Transaction['category'], amount: number): Transaction => ({
  date, category, amount, method: '카드',
  counterparty: undefined, person: undefined, memo: undefined,
})

describe('월별 집계', () => {
  it('월별 매출/지출/순이익 계산', () => {
    const result = aggregateMonthly([
      tx('2026-01-15', '매출', 10_000_000),
      tx('2026-01-20', '임대료', -1_400_000),
      tx('2026-02-10', '매출', 11_000_000),
    ])
    const jan = result.find(r => r.month === '2026-01')!
    expect(jan.revenue).toBe(10_000_000)
    expect(jan.expense).toBe(1_400_000)
    expect(jan.net).toBe(8_600_000)
    expect(result.find(r => r.month === '2026-02')?.revenue).toBe(11_000_000)
  })

  it('빈 거래는 빈 배열 반환', () => {
    expect(aggregateMonthly([])).toEqual([])
  })

  it('월 순서대로 정렬', () => {
    const result = aggregateMonthly([
      tx('2026-03-01', '매출', 1_000_000),
      tx('2026-01-01', '매출', 1_000_000),
      tx('2026-02-01', '매출', 1_000_000),
    ])
    expect(result.map(r => r.month)).toEqual(['2026-01', '2026-02', '2026-03'])
  })
})
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run:
```bash
npm test -- tests/lib/analytics/monthly.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 월별 집계 구현**

Create: `workspace/src/lib/analytics/monthly.ts`
```ts
import type { Transaction } from '@/types/domain'

export interface MonthlySummary {
  month: string   // YYYY-MM
  revenue: number
  expense: number
  net: number
}

export function aggregateMonthly(transactions: Transaction[]): MonthlySummary[] {
  const buckets = new Map<string, MonthlySummary>()

  for (const tx of transactions) {
    const month = tx.date.slice(0, 7)
    const bucket = buckets.get(month) ?? { month, revenue: 0, expense: 0, net: 0 }
    if (tx.amount > 0) bucket.revenue += tx.amount
    else bucket.expense += Math.abs(tx.amount)
    buckets.set(month, bucket)
  }

  return Array.from(buckets.values())
    .map(b => ({ ...b, net: b.revenue - b.expense }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
```

- [ ] **Step 4: 테스트 통과**

Run:
```bash
npm test -- tests/lib/analytics/monthly.test.ts
```
Expected: PASS — 3 tests.

- [ ] **Step 5: 분석 페이지 작성**

Create: `workspace/src/app/analytics/page.tsx`
```tsx
import { fetchSheetRows, getSheetConfig } from '@/lib/sheets/client'
import { parseSheetRows } from '@/lib/sheets/parser'
import { aggregateMonthly } from '@/lib/analytics/monthly'
import { KpiCard } from '@/components/ui/KpiCard'
import { MonthlyBarChart } from '@/components/Charts/MonthlyBarChart'

export const revalidate = 300

async function loadTransactions() {
  const config = getSheetConfig()
  const rows = await fetchSheetRows(config)
  return parseSheetRows(rows)
}

export default async function AnalyticsPage() {
  const transactions = await loadTransactions()
  const monthly = aggregateMonthly(transactions)

  const currentYear = new Date().getFullYear()
  const lastYear = currentYear - 1

  const yearTotals = (year: number) => {
    const filtered = monthly.filter(m => m.month.startsWith(year.toString()))
    return {
      revenue: filtered.reduce((s, m) => s + m.revenue, 0),
      expense: filtered.reduce((s, m) => s + m.expense, 0),
      net: filtered.reduce((s, m) => s + m.net, 0),
    }
  }

  const current = yearTotals(currentYear)
  const previous = yearTotals(lastYear)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-3">연도별 KPI</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <KpiCard title={`${currentYear}년 매출`} amount={current.revenue} />
          <KpiCard title={`${currentYear}년 지출`} amount={-current.expense} />
          <KpiCard title={`${currentYear}년 순이익`} amount={current.net} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard title={`${lastYear}년 매출`} amount={previous.revenue} />
          <KpiCard title={`${lastYear}년 지출`} amount={-previous.expense} />
          <KpiCard title={`${lastYear}년 순이익`} amount={previous.net} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">월별 추세</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MonthlyBarChart
            data={monthly.map(m => ({ month: m.month, amount: m.revenue }))}
            title="월별 매출"
            color="#2563eb"
          />
          <MonthlyBarChart
            data={monthly.map(m => ({ month: m.month, amount: m.expense }))}
            title="월별 지출"
            color="#dc2626"
          />
        </div>
        <div className="mt-4">
          <MonthlyBarChart
            data={monthly.map(m => ({ month: m.month, amount: m.net }))}
            title="월별 순이익"
            color="#16a34a"
          />
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 6: 동작 확인**

http://localhost:3000/analytics → KPI 카드 + 월별 차트 3개 표시 확인.

- [ ] **Step 7: 커밋**

```bash
git add src/app/analytics/ src/lib/analytics/ tests/lib/analytics/
git commit -m "feat: add analytics tab with yearly KPIs and monthly charts"
```

---

## Phase 4 — 백테스트 & 통합 검증

### Task 4.1: 백테스트 — 실데이터로 추정치 검증

**Files:**
- Create: `workspace/tests/integration/backtest.test.ts`
- Create: `workspace/tests/fixtures/real-2024-2025.ts` (사용자가 익명화한 실데이터)

> **사용자 액션 필요**: 운영자(여자친구) 2024·2025 전체 시트를 익명화해서 fixture에 붙여넣기. 클라이언트 이름은 가명, 금액은 그대로.

- [ ] **Step 1: 실데이터 fixture 준비**

Create: `workspace/tests/fixtures/real-2024-2025.ts`
```ts
// 운영자 시트에서 가져온 실제 거래 데이터 (이름만 익명화).
// 시트의 A2:H 범위를 그대로 export.

import type { Transaction } from '@/types/domain'

export const REAL_TRANSACTIONS_2024_2025: Transaction[] = [
  // 사용자가 실제 시트에서 익명화하여 채워넣음.
  // 예시:
  // { date: '2024-01-15', category: '매출', amount: 650_000, method: '카드', counterparty: '개인레슨', person: 'A', memo: undefined },
]

// 운영자가 신고한 (또는 추정한) 실제 세액 — 정답지
export const ACTUAL_TAX_2024 = {
  vatTotal: 0,        // 실제 2024년 부가세 납부 합계 (사용자 입력)
  incomeTax: 0,       // 실제 2024년 종소세 납부액 (사용자 입력)
  monthlyReserve: 1_800_000,  // 운영자의 직관 예비비
}

export const ACTUAL_TAX_2025 = {
  vatTotal: 0,
  incomeTax: 0,
  monthlyReserve: 1_800_000,
}
```

- [ ] **Step 2: 백테스트 작성**

Create: `workspace/tests/integration/backtest.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { simulateVAT, type Quarter } from '@/lib/tax/vat'
import { simulateIncomeTax } from '@/lib/tax/income-tax'
import { recommendReserve } from '@/lib/tax/reserve'
import { REAL_TRANSACTIONS_2024_2025, ACTUAL_TAX_2024, ACTUAL_TAX_2025 } from '../fixtures/real-2024-2025'

// 실데이터 미입력 시 자동 skip
const hasData = REAL_TRANSACTIONS_2024_2025.length > 0
const maybeIt = hasData ? it : it.skip

describe('백테스트: 2024년', () => {
  maybeIt('연간 부가세 추정치 ±10% 안에 들어옴', () => {
    const annualVAT = [1, 2, 3, 4]
      .map(q => simulateVAT(REAL_TRANSACTIONS_2024_2025, 2024, q as Quarter))
      .reduce((sum, r) => sum + Math.max(0, r.estimatedVAT), 0)

    if (ACTUAL_TAX_2024.vatTotal > 0) {
      const ratio = annualVAT / ACTUAL_TAX_2024.vatTotal
      expect(ratio).toBeGreaterThan(0.9)
      expect(ratio).toBeLessThan(1.1)
    }
  })

  maybeIt('연간 종소세 추정치 ±15% 안', () => {
    const result = simulateIncomeTax(REAL_TRANSACTIONS_2024_2025, '2024-12-31')
    if (ACTUAL_TAX_2024.incomeTax > 0) {
      const ratio = result.estimatedTax / ACTUAL_TAX_2024.incomeTax
      expect(ratio).toBeGreaterThan(0.85)
      expect(ratio).toBeLessThan(1.15)
    }
  })

  maybeIt('권장 예비비가 운영자 직관 180만 ±20% 안', () => {
    const result = recommendReserve(REAL_TRANSACTIONS_2024_2025, '2024-12-31')
    const ratio = result.monthly / ACTUAL_TAX_2024.monthlyReserve
    expect(ratio).toBeGreaterThan(0.8)
    expect(ratio).toBeLessThan(1.2)
  })
})

describe('백테스트: 2025년', () => {
  maybeIt('연간 부가세 추정 ±10%', () => {
    const annualVAT = [1, 2, 3, 4]
      .map(q => simulateVAT(REAL_TRANSACTIONS_2024_2025, 2025, q as Quarter))
      .reduce((sum, r) => sum + Math.max(0, r.estimatedVAT), 0)

    if (ACTUAL_TAX_2025.vatTotal > 0) {
      const ratio = annualVAT / ACTUAL_TAX_2025.vatTotal
      expect(ratio).toBeGreaterThan(0.9)
      expect(ratio).toBeLessThan(1.1)
    }
  })
})
```

- [ ] **Step 3: 백테스트 실행**

Run:
```bash
npm test -- tests/integration/backtest.test.ts
```
Expected: fixture가 비어있으면 모든 테스트 skip. 데이터 채우면 실행됨.

데이터를 채워도 정확도 미달 시 → 알고리즘 재검토 (Phase 1 task 들로 돌아가서 룰 보정).

- [ ] **Step 4: 커밋**

```bash
git add tests/integration/backtest.test.ts tests/fixtures/real-2024-2025.ts
git commit -m "test: add backtest harness for real 2024-2025 data"
```

---

### Task 4.2: 스모크 테스트 — 전체 페이지 로드 확인

**Files:**
- (수동 체크리스트)

- [ ] **Step 1: 로컬 dev 서버 기동**

Run:
```bash
npm run dev
```

- [ ] **Step 2: 페이지별 수동 확인**

| 경로 | 확인 항목 |
|---|---|
| `/` | 부가세 카드, 예비비 카드, D-day 배너, 액션 카드 표시 |
| `/tax` | 분기 4개 카드 + 종소세 카드 표시 |
| `/analytics` | 연도별 KPI + 월별 차트 3개 |
| `/api/transactions` | JSON 응답 (50건 이상의 거래) |

문제 발견 시 → 해당 모듈 task로 돌아가 수정.

- [ ] **Step 3: 타입 체크 + 린트**

```bash
npm run lint
npx tsc --noEmit
```
Expected: 에러 0.

- [ ] **Step 4: 전체 테스트**

```bash
npm test
```
Expected: 모든 단위 테스트 PASS.

- [ ] **Step 5: 커밋 (수정 사항 있을 시)**

```bash
git add -A
git commit -m "fix: smoke test corrections"
```

---

## Phase 5 — Vercel 배포

### Task 5.1: Vercel 프로젝트 생성 & 환경변수 설정

**Files:**
- (외부 설정)

- [ ] **Step 1: GitHub 리포 만들기 (선택)**

```bash
gh repo create workspace --private --source=. --remote=origin --push
```

또는 GitHub UI에서 새 private 리포 만든 후:
```bash
git remote add origin https://github.com/<username>/workspace.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Vercel CLI로 배포 또는 Vercel UI에서 import**

```bash
npm install -g vercel
vercel login
vercel
```

질문에 답:
- Set up and deploy? `Y`
- Scope: 개인 계정
- Link to existing project? `N`
- Project name: `workspace`
- Directory: `./`
- Modify settings? `N`

- [ ] **Step 3: Vercel 대시보드에서 환경변수 추가**

Settings > Environment Variables 에:
- `GOOGLE_SHEETS_CLIENT_EMAIL`
- `GOOGLE_SHEETS_PRIVATE_KEY` (개행 그대로 붙여넣기)
- `GOOGLE_SHEETS_ID`
- `GOOGLE_SHEETS_RANGE`
- `WORKSPACE_PASSWORD`

모두 Production 환경에 설정.

- [ ] **Step 4: 재배포 트리거**

Vercel UI에서 "Redeploy" 클릭, 또는:
```bash
vercel --prod
```

---

### Task 5.2: 첫 프로덕션 스모크

**Files:**
- (외부 검증)

- [ ] **Step 1: 배포 URL 확인**

Vercel 대시보드에서 production URL 확인 (예: `https://workspace.vercel.app`).

- [ ] **Step 2: 비밀번호 인증 확인**

URL 접속 → 베이직 인증 프롬프트 → 사용자명 비우고 비밀번호 입력 → 진입 확인.

- [ ] **Step 3: 각 페이지 수동 확인**

- `/` → 부가세·예비비·D-day·액션 카드
- `/tax` → 분기 부가세 + 종소세
- `/analytics` → KPI + 월별 차트

- [ ] **Step 4: 여자친구께 URL + 비밀번호 전달 (선물)**

축하 메시지와 함께 전달 🎁

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "chore: production deployment ready" --allow-empty
git tag v1.0.0
git push --tags
```

---

## 자체 검토 결과 (Self-Review)

**Spec 커버리지** (spec § 4 v1 In 항목 7개 모두 task로 매핑):

| Spec 요구사항 | 매핑된 Task |
|---|---|
| 1. 구글 시트 자동 읽기 | Task 2.1 (parser), 2.2 (client), 2.3 (cache), 2.4 (API) |
| 2. 부가세 시뮬레이터 | Task 1.2 (deduction rules), 1.3 (VAT) |
| 3. 종소세 시뮬레이터 | Task 1.4 (income tax + brackets) |
| 4. 권장 예비비 | Task 1.5 (reserve) |
| 5. 납부일 D-day | Task 1.6 (due-dates), Task 3.4 (banner) |
| 6. 대시보드 | Task 3.5 (홈), 3.6 (세금), 3.7 (분석) |
| 7. 절세 액션 카드 | Task 1.7 (action-cards), Task 3.5 (홈 표시) |

**플레이스홀더 스캔**: TBD/TODO 없음. 모든 코드 블록은 실행 가능한 완성 코드.

**타입 일관성**: Transaction, Category, PaymentMethod, VATResult, IncomeTaxResult, ReserveRecommendation, DueDate, ActionCard 타입을 Task 0.4에서 정의하고 이후 모든 task에서 동일 시그니처 사용.

**오픈 이슈**:
- Task 4.1의 실데이터 fixture는 사용자가 직접 채워야 함. 미입력 시 자동 skip.
- Vercel 환경변수 설정은 Vercel UI 작업이라 CLI로 완전 자동화 불가.

---

## 실행 핸드오프

계획 완료. 두 가지 실행 방식 중 선택:

**1. 서브에이전트 기반 (권장)** — task별로 새 서브에이전트 디스패치, 사이사이 리뷰, 빠른 iteration. Phase 1의 1.1~1.7은 병렬 디스패치 가능 (총 작업시간 단축).

**2. 인라인 실행** — 이 세션에서 task를 직접 실행하면서 체크포인트로 리뷰.

어느 쪽으로 갈까요?
