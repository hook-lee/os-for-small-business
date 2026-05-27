# Onmove — 의사결정 로그 (ADR)

> **목적**: 왜 이렇게 만들었는지 기록. 미래에 누군가 (또는 미래의 Claude가) "왜 이런 구조지?" 물을 때 답변.
>
> 새 결정 시 가장 아래에 추가. 옛 결정 뒤집을 땐 새 항목 만들고 "supersedes: ADR-N" 표기.

---

## ADR-001 — Next.js 16 채택

- **시점**: 2026-05
- **상태**: 채택
- **컨텍스트**: 단순 dashboard에서 SaaS로 진화. 풀스택 + auth + RLS 필요.
- **결정**: Next.js 16 App Router (Server Components + Server Actions)
- **대안**:
  - Remix: 비슷한 SSR, 다만 deploy 옵션 적음
  - Vite + Express: 더 가볍지만 SSR/SEO 직접 구현 부담
  - Astro: 정적 우선이라 SaaS 부적합
- **트레이드오프**:
  - + Vercel 무료 deploy, RSC로 server-side 데이터 fetch 자연
  - + 학습 곡선 mild
  - − Next 16 신 conventions, 학습 데이터의 옛 패턴이 함정 (AGENTS.md에서 경고)

---

## ADR-002 — Supabase (Auth + Postgres + RLS) 채택

- **시점**: 2026-05 (multi-tenant 전환 시점)
- **상태**: 채택
- **컨텍스트**: SaaS 전환 시 인증 + DB 모두 필요. 직접 구축 vs SaaS
- **결정**: Supabase
- **대안**:
  - Firebase: NoSQL, 우리는 관계형 데이터 많음
  - PlanetScale + Clerk: 두 SaaS 통합 부담
  - 자체 Postgres + NextAuth: 운영 부담 큼
- **트레이드오프**:
  - + 무료 tier 충분 (라파 규모)
  - + RLS로 DB 레벨 격리 보장
  - + Auth + DB 같은 곳, 토큰 검증 자연스러움
  - − Free tier에 manual backup 없음 (Pro $25/월)
  - − pg_dump 같은 도구 별도 셋업 필요

---

## ADR-003 — Multi-tenant: 단일 DB + owner_id 컬럼

- **시점**: 2026-05-25
- **상태**: 채택
- **컨텍스트**: 새 사용자 가입 가능한 SaaS로 전환. 데이터 격리 필요.
- **결정**: Row-level isolation — 모든 사용자 데이터 테이블에 `owner_id` 컬럼 + RLS policy
- **대안**:
  - Schema-per-tenant: 강한 격리, 다만 마이그레이션/백업 복잡
  - DB-per-tenant: 최강 격리, 비용 N배
  - 단일 DB row-level: 표준 SaaS 패턴
- **트레이드오프**:
  - + 단일 DB로 운영 단순
  - + RLS로 코드 버그여도 DB 차원 격리
  - − 모든 쿼리에 owner_id 필터 강제 (실수 위험 → AGENTS.md + tenant-auditor agent로 방어)
  - − 사용자별 사용량 모니터링 어려움 (집계 쿼리에 owner_id 분리 필요)

---

## ADR-004 — AI 비서: Gemini 2.5 Flash 채택 (vs Claude/GPT)

- **시점**: 2026-05
- **상태**: 채택
- **컨텍스트**: AI 비서가 핵심 차별점. 비용 + 정확도 + 한국어 능력 평가.
- **결정**: Gemini 2.5 Flash + Function Calling
- **대안**:
  - Claude Sonnet 4.5: 한국어/세무 정확도 가장 높음. $3/1M input
  - GPT-4o-mini: 비슷한 가격대, 한국어 약간 떨어짐
  - 자체 호스팅 Llama: 비용 0, 다만 한국어/세무 능력 낮음
- **트레이드오프**:
  - + 무료 tier 1500/일, 라파 1인 운영자 한도 절대 안 닿음
  - + 1M 토큰 context (모든 데이터 한 번에 컨텍스트 가능)
  - + Function Calling 정확도 충분
  - − 한국어/세무 정확도 5-10% 양보 (Claude 대비)
  - − Anthropic 채팅 인프라 의존성 X (다행)
- **추후 교체 가능**: `src/lib/ai/gemini.ts` 추상화 — 5분 작업으로 Claude로 교체 가능

---

## ADR-005 — 매출 source of truth: transactions, NOT passes

- **시점**: 2026-05-25
- **상태**: 채택
- **컨텍스트**: `passes`(스튜디오메이트 import) 결제 데이터가 `transactions` 매출과 중복 합산되어 매출이 2배로 부풀려진 사건.
- **결정**: 매출 통계는 *오직* `transactions.category === '매출'` row만. `passes.payment_amount`는 회원 결제 이력 (참고용).
- **대안**:
  - passes를 source of truth로 — 자동 발급 흐름과 정합. 다만 외부 import 데이터 신뢰 어려움.
  - 두 source 합산 + 중복 제거 로직 — 복잡, 사용자 입장에서 불투명
- **트레이드오프**:
  - + 사용자가 직접 입력한 것만 신뢰 (control 강함)
  - + 매출 페이지 명확 (가계부 + 참고)
  - − 회원 결제 흐름과 매출이 이중 입력 가능 (코드에서 자동 동기화: AddForm에서 회원+수강권 선택 시 둘 다 동시 생성)

---

## ADR-006 — Default 카테고리 24개를 코드에 박아두기 (DB 시드 X 의존)

- **시점**: 2026-05
- **상태**: 채택
- **컨텍스트**: `expense_categories` 테이블에 시드 데이터 미실행 시 카테고리 안 보이는 문제.
- **결정**: `src/lib/categories/defaults.ts`에 24개 default 박아두기. DB 시드는 별도 (선택).
- **트레이드오프**:
  - + 시드 실행 안 해도 기본 동작
  - + 사용자가 카테고리 추가하면 DB의 값 우선
  - − 카테고리 수정/번역 시 코드 + DB 둘 다 관리

---

## ADR-007 — 세금 페이지: 라파 사업자 유형 타임라인을 코드에 박기

- **시점**: 2026-05-25
- **상태**: 채택 (라파 본인 한정)
- **컨텍스트**: 라파의 간이→일반→간이 전환 시점이 명확. 다른 사용자는 다를 것.
- **결정**: `TAX_PERIODS` 상수에 라파 케이스 박기. 다른 사용자도 일단 같은 타임라인 (잘못된 경우 ⬜)
- **대안**:
  - 사용자별 settings에서 타임라인 입력 — 진짜 SaaS 답
- **트레이드오프**:
  - + 라파 본인 use case 즉시 동작
  - − 다른 사용자에게 부정확
- **⬜ 미래**: 사용자별 sole proprietor / corporate / VAT 유형 입력받는 UI 필요

---

## ADR-008 — service_role 키는 server-only

- **시점**: 2026-05
- **상태**: 채택 (보안 핵심)
- **결정**:
  - `src/lib/supabase/client.ts`: service_role (server only)
  - `src/lib/supabase/auth-browser.ts`: anon key (client 가능)
  - `auth-server.ts`: createServerClient (SSR auth, anon + 쿠키)
- **트레이드오프**:
  - + service_role 키 leak 시에도 클라이언트엔 노출 X
  - + RLS 우회 능력은 server-side로 제한
  - − 클라이언트는 데이터 fetch 위해 항상 우리 API 거쳐야 함 (다만 보안상 옳음)

---

## ADR-009 — 회원 토큰 페이지는 인증 우회 (token = 자격증명)

- **시점**: 2026-04 (v1) → 2026-05 multi-tenant 시 재확인
- **상태**: 채택
- **결정**: `/m/[token]/*` 페이지는 미인증 접근 허용. `fetchMemberByToken`은 owner_id 필터 X (token globally unique).
- **대안**: 회원도 로그인하게 (Magic Link)
- **트레이드오프**:
  - + 회원 UX 단순 (카톡 링크 → 클릭만)
  - − token 유출 시 다른 사람도 접근 (만료 X)
  - **⬜ 추후**: token 만료 정책

---

## ADR-010 — 하네스 (CLAUDE.md / AGENTS.md / docs/ / .claude/) 본격 구축

- **시점**: 2026-05-25
- **상태**: 채택
- **컨텍스트**: 옛 하네스가 v1 가정으로 박혀있어 다음 세션 작업 시 multi-tenant 룰을 까먹을 위험.
- **결정**:
  - `AGENTS.md`: 7.8KB 본격 룰북
  - `docs/PRD.md`, `IA.md`, `USER-FLOWS.md`, `ROADMAP.md`, `DECISIONS.md`(이 파일)
  - `.claude/skills/add-feature`, `multi-tenant-check`
  - `.claude/agents/tenant-auditor.md`
- **효과**: 새 세션의 Claude가 다음을 보고 시작:
  1. CLAUDE.md → AGENTS.md priming
  2. 작업 종류에 따라 add-feature skill 또는 tenant-auditor agent dispatch

---

## ⬜ 결정 보류 / 사용자 의견 필요

### D-1: 가격 정책
무료 / Freemium / Flat / 사용량 기반 — 어떤 모델?

### D-2: 강사 권한 분리
강사 본인 로그인 — 필요? 라파는 1인 운영이라 우선순위 낮음.

### D-3: 다국어
한국어만 vs 영어 추가

### D-4: 백업 정책
Supabase Pro $25/월로 자동 백업 활성화 vs 자체 cron으로 pg_dump

### D-5: 모니터링
Sentry / Posthog 도입 — 사용자 행동 분석 필요?

### D-6: 회원 결제를 우리가 받기?
현재: 사장님이 매출 입력. 미래: 회원이 카드 결제 → 자동 입력?
- PG 라이센스 필요 / 복잡 / 가치 큼

---

## ADR 작성 가이드 (새 결정 시)

```markdown
## ADR-NNN — 한 줄 제목

- **시점**: YYYY-MM-DD
- **상태**: 채택 / 검토 중 / 폐기 (supersedes: ADR-XXX)
- **컨텍스트**: 왜 결정이 필요했나
- **결정**: 정확히 무엇으로
- **대안**: 검토했던 다른 옵션들
- **트레이드오프**: + / − 명시
- **(선택)** 추후 교체 가능성 / 마이그레이션 비용
```
