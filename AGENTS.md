<!-- BEGIN:onmove-agent-rules -->
# Onmove — 운동 센터 사장님용 SaaS

운동 스튜디오(필라테스/PT/요가) 사장님이 회원·강사·매출·세금을 한 곳에서 관리하는 SaaS.
운영 계정: 라파 필라테스 (`raphapilatesyj@gmail.com`)가 최초 + 추가 가입 가능.

## ⚡ 작업 시작 전 반드시 확인

1. **이건 Next.js 16** — 16 conventions. `node_modules/next/dist/docs/`의 가이드 우선. 학습 데이터의 옛 14/15 패턴 X.
2. **모든 사용자 데이터는 multi-tenant** — `owner_id uuid references auth.users(id)`.
3. **service_role 키는 server-side만** — 절대 클라이언트에 노출 X.

---

# 🛡️ Multi-tenant 룰 (가장 중요)

모든 사용자 데이터 테이블(14개)에 `owner_id` 컬럼 + RLS policy 존재:
`transactions`, `members`, `instructors`, `passes`, `pass_products`, `lessons`,
`group_sessions`, `payroll_records`, `expense_categories`, `message_records`,
`chat_sessions`, `profile` (직접 격리)
+ `group_reservations`, `pass_adjustments`, `chat_messages` (parent 통해 간접 격리).

## 새 supabase 쿼리 작성 시

**Read**:
```typescript
let q = supabase.from('table').select('*')
if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
```

**Insert**:
```typescript
const row: Record<string, unknown> = { /* fields */ }
if (ownerId !== 'no-auth') row.owner_id = ownerId
await supabase.from('table').insert(row)
```

**Update/Delete** (방어 — 다른 owner row 못 만짐):
```typescript
let q = supabase.from('table').delete().eq('id', id)
if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
```

## API route 표준 패턴

```typescript
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function POST(req: Request) {
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  // ... 모든 lib 호출에 ownerId 전달
}
```

## 예외 (인증 우회)

- `/api/health` — 진단
- `/api/auth/*` — 로그인/로그아웃
- `/api/m/*` — 회원 토큰 페이지가 호출
- `/m/[token]/*` — 회원 토큰 URL (token이 globally unique한 자격증명)
- `fetchMemberByToken` — 토큰만으로 조회 (auth 우회). 다음 쿼리들은 `member.ownerId` 사용.

## 특수 케이스

- **expense_categories**: `is_default=true`(24개 시드)는 공용. select 시 `.or('owner_id.eq.${ownerId},is_default.eq.true')`. is_default row는 update/delete 차단.
- **profile**: id default 1 + check 제약이 옛날에 있었음 → v3.2 마이그레이션으로 sequence로 변경. `saveProfile`은 SELECT 후 INSERT/UPDATE 분기.
- **`'no-auth'` sentinel**: `requireOwnerId()`가 환경변수 미설정 시(hasAuthConfig=false) 반환. lib는 이 값일 때 owner_id 필터 생략 (로컬 dev fallback).

---

# 📊 도메인 룰 (자주 까먹는 것들)

## 카테고리 분류 (transactions.classification)

xlsx 우측 패널의 분류와 우리 코드의 classification:

| classification | 카테고리 | 의미 |
|---|---|---|
| `business` | 사업 비용 9개: 급여 / 유진 급여 / 예비비 / 임대료 / 관리비 / 세금 / 공과금 / 보험료 / 정기결제 | 영업이익 차감 |
| `living` | 개인 비용 12개: 교통비 / 품위유지비 / 교육비 / 식비 / 의류비 / 의료비 / 소모품 / 소품 / 도서인쇄비 / 마케팅비 / 경조사비 / 수수료 | 순수익 차감 |
| `capital` | 자산 / 보통예금 / 사무용품 | 비용 합계 제외 (감가상각 대상) |
| `reserve` | 예비비 | 세금 적립용. 비용 X |
| `owner_draw` | 대표자급여 / 유진 급여 | 사업소득 차감 X |

`src/lib/analytics/monthly-summary.ts`의 `BUSINESS_COST_CATEGORIES` / `PERSONAL_COST_CATEGORIES` 상수가 source of truth.

## 세금 — 사업자 유형 전환 타임라인

라파 케이스 (`src/lib/analytics/tax-history.ts`의 `TAX_PERIODS`):
- **2024-04 ~ 2025-06**: 간이과세자 (15개월)
- **2025-07 ~ 2026-06**: 일반과세자 (12개월, 매출 1억800만 초과 → 강제 전환)
- **2026-07 ~**: 직전 1년 매출 < 1억800만 시 간이 전환 가능

부가세 계산:
- 간이: `매출 × 30% × 10% = 매출의 3%`
- 일반: `매출세액 - 매입세액` (`isVATDeductible`에 따라)

## 수업 차감 룰

`src/lib/supabase/lessons.ts`의 `DEDUCTED_STATUSES`:
- `completed` / `cancelled_same_day` / `noshow` → 차감
- `scheduled` / `cancelled_advance` → 차감 X

상태 변경 시 `passes.remaining_count` 자동 ±1 + 만료 시 status='이용만료' 자동 전환.

## 결제수단 정규화

`'카드' / '계좌이체' / '현금'` 3개만 표준. `'네이버페이'` 등은 `'카드'`로 매핑.

---

# 🔐 보안 룰

1. **service_role 키**: 절대 클라이언트 노출 X. `src/lib/supabase/auth-browser.ts`는 anon key만.
2. **회원 phone**: AI 비서 tool에서 자동 마스킹 (`maskPhone`).
3. **에러 메시지**: DB 구조 leak 가능한 message는 server log에만, client엔 일반화.
4. **Rate limit**: `/api/chat` 분당 10회 / 시간당 60회. `/api/auth/signup-check` IP 기반 분당 3회.
5. **RLS 활성화 상태** — 모든 사용자 테이블. service_role은 자동 우회 (우리 앱은 영향 X).

---

# 🏗️ 코드 스타일

- TypeScript strict. `any` 금지.
- 모든 금액: `.toLocaleString()` + `원` 접미사.
- 한국어 UI 라벨. 코드 주석은 한국어 OK.
- Server pages: `requireOwnerId().catch(() => 'no-auth')` → lib 호출.
- Client components: 별도 파일 (`page.tsx`는 server, `[Name].tsx`는 client).
- 컴포넌트: `@/components/ui/Card`, charts in `@/components/Charts/`.
- Tests: Vitest. lib 함수는 pure → 단위 테스트. 197+ tests, 모두 pass 유지.

---

# 🚫 절대 하지 말 것

1. `passes` 테이블 결제 금액(`payment_amount`)을 매출 통계에 합산 — `transactions`의 매출 카테고리만 source of truth.
2. 24~25년 transactions 임의 삭제 — xlsx 전체가 source of truth (2,917건).
3. `owner_id` 필터 빼먹기 — 다른 사용자 데이터 누출 위험.
4. AI 비서 tool에서 회원 phone 평문 노출.
5. `service_role` 키를 NEXT_PUBLIC_ 변수로 export.
6. `git commit` / `git push` — 사용자가 명시적으로 요청할 때만.

---

# 📂 핵심 파일 위치 (빠른 reference)

| 영역 | 위치 |
|---|---|
| Auth helper | `src/lib/supabase/auth-server.ts` (`requireOwnerId`, `getCurrentUser`) |
| Auth browser | `src/lib/supabase/auth-browser.ts` (anon key, 클라이언트용) |
| Service role client | `src/lib/supabase/client.ts` (server data 조회) |
| Profile | `src/lib/profile/settings.ts` (workspace_name 등) |
| Transactions loader | `src/lib/data/loader.ts` (ownerId별 Map 캐시) |
| 카테고리 정규화 | `src/lib/categories/normalize.ts` |
| 카테고리 default 24개 | `src/lib/categories/defaults.ts` |
| 세금 시뮬레이터 | `src/lib/tax/{vat,income-tax,reserve,due-dates}.ts` |
| 월별 요약 분석 | `src/lib/analytics/monthly-summary.ts` |
| 세금 history 분석 | `src/lib/analytics/tax-history.ts` |
| AI 비서 tool 정의 | `src/lib/ai/tools.ts` (factory: `buildTools(ownerId)`) |
| Gemini 클라이언트 | `src/lib/ai/gemini.ts` |
| Rate limit | `src/lib/security/rate-limit.ts` |
| Middleware | `middleware.ts` (인증 + 보안 헤더) |
| DB 스키마 | `supabase/schema.sql` |
| 마이그레이션 | `supabase/v3-saas-migration.sql`, `v3.1-rls.sql`, `PENDING-MIGRATIONS.sql` |

---

# 🧪 작업 끝낼 때 검증 (모두 통과해야 함)

```bash
cd /c/Users/leech/dev/business-os/workspace
npx tsc --noEmit
npx vitest run --reporter=dot
npx next build
```

세 가지 다 pass → commit 검토 가능. 실패 시 원인 추적 + fix.
<!-- END:onmove-agent-rules -->
