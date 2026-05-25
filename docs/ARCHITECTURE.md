# Onmove Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  사용자 브라우저 (Chrome/Safari)              │
│  - Next.js client components (React 19)                      │
│  - Supabase auth-browser (anon key) → 세션 쿠키              │
│  - Floating AI 비서 widget (모든 admin 페이지)               │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS (HSTS 강제)
                         ↓
┌──────────────────────────────────────────────────────────────┐
│                  Vercel Edge / Node.js Runtime                │
│  middleware.ts: 인증 + 보안 헤더 (CSP, XFO, ...)             │
│  ├─ public paths: /login, /signup, /m/*, /api/health, ...    │
│  └─ protected: 세션 검증 → 미인증 시 /login?next=...        │
│                                                                │
│  Server Components: server-side data fetch (service_role)    │
│  - layout.tsx → loadProfile(user.id)                         │
│  - finances/page.tsx → loadTransactions(ownerId) →           │
│      computeAllMonthsSummary                                  │
│                                                                │
│  API Routes (/api/*):                                         │
│  - requireOwnerId() → 401 또는 ownerId                        │
│  - 모든 lib 호출에 ownerId 전달                              │
│  - Rate limit (in-memory, Map 기반)                          │
└────────────────────────┬─────────────────────────────────────┘
                         │ service_role (server-only)
                         ↓
┌──────────────────────────────────────────────────────────────┐
│                       Supabase                                │
│  ├─ Auth (이메일/비번)                                       │
│  ├─ Postgres                                                  │
│  │   ├─ owner_id 격리된 14개 테이블                          │
│  │   ├─ RLS policy (사용자 격리, service_role 우회)          │
│  │   └─ 마이그레이션: v2.6 ~ v3.2                           │
│  └─ Realtime (미사용)                                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                  외부 API (server-side만 호출)                │
│  Google Gemini 2.5 Flash                                      │
│  - /api/chat → buildTools(ownerId) → Function Calling 루프   │
│  - 7개 tool (members, instructors, financials, tax, ...)     │
│  - chat_sessions + chat_messages에 영속화                    │
└──────────────────────────────────────────────────────────────┘
```

## 데이터 흐름 — 거래 입력 예시

```
사용자: /add에서 "5월 15일, 매출 770,000원, 회원=박지영, 수강권=개인 30회"
   ↓
AddForm.tsx (client) → POST /api/passes (수강권 발급)
   ↓
API route:
  1. requireOwnerId() → ownerId
  2. issuePass({memberId, productId, ..., ownerId}, product)
     → passes 테이블에 owner_id 박힌 row INSERT
   ↓
응답: { ok: true, id: 1234 }
   ↓
client: 폼 리셋 + 최근 입력 refresh
```

## 데이터 흐름 — AI 비서 질문 예시

```
사용자: 우하단 챗 → "5월 광고비 얼마 썼어?"
   ↓
FloatingAssistant.tsx (client) → POST /api/chat
  body: { message, sessionId, context: { pathname, pageLabel } }
   ↓
API route:
  1. requireOwnerId() → ownerId
  2. rate limit check (10/min, 60/hr)
  3. session 확보 + user 메시지 영속화 (chat_messages)
  4. loadProfile(ownerId) → workspaceName
  5. buildSystemPrompt({pathname, pageLabel, workspaceName})
  6. buildTools(ownerId) — ownerId 클로저 주입
  7. chatWithTools(...) → Gemini Function Calling 루프
     ↓
     Gemini: "getMonthlyFinancials(year=2026, month=5) 호출"
     ↓
     tool execute: loadTransactions(ownerId) → 5월 transactions 집계
     ↓
     Gemini: "5월 광고선전비 ₩78,559. 마케팅비 0원..."
   ↓
응답: { reply, toolCalls, sessionId }
   ↓
client: 답변 표시 + chat_messages.insert (model)
```

## 다층 보안

| 층 | 보호 |
|---|---|
| Network | HTTPS (HSTS), CSP, X-Frame-Options |
| Auth | Supabase Auth (이메일/비번 + 세션 쿠키) |
| Routing | middleware 인증 가드, 미인증 → /login |
| API | requireOwnerId() → 401 |
| Lib | 모든 query에 .eq('owner_id', ownerId) |
| DB | RLS policy (코드 버그여도 격리) |
| Abuse | Rate limit (사용자별 / IP별) |
| Data | service_role server-only, 회원 phone 마스킹 |

## 핵심 디렉토리

```
workspace/
├── AGENTS.md              ← 모든 Claude 작업의 첫 reference
├── CLAUDE.md              ← @AGENTS.md + 사용자 컨텍스트
├── docs/
│   ├── PRD.md             ← 현재 제품 상태
│   ├── ARCHITECTURE.md    ← (이 파일)
│   └── specs/             ← 옛 v1 design (archived)
├── .claude/
│   ├── skills/
│   │   ├── add-feature/   ← 새 기능 추가 절차
│   │   └── multi-tenant-check/  ← owner_id 누락 감사
│   └── agents/
│       └── tenant-auditor.md   ← 격리 검증 agent
├── middleware.ts
├── src/
│   ├── app/               ← Next.js 16 App Router
│   ├── components/
│   ├── lib/
│   │   ├── ai/            ← Gemini + tools
│   │   ├── analytics/     ← monthly-summary, tax-history, ...
│   │   ├── categories/    ← normalize, defaults
│   │   ├── data/          ← loader (Map<ownerId, ...>)
│   │   ├── profile/       ← settings (INSERT/UPDATE 분기)
│   │   ├── security/      ← rate-limit
│   │   ├── supabase/      ← client (service), auth-server/browser
│   │   └── tax/           ← vat, income-tax, reserve
│   └── types/             ← domain types
├── supabase/
│   ├── schema.sql         ← 정본 (새 환경 init용)
│   ├── PENDING-MIGRATIONS.sql  ← v2.6~2.11 migration
│   ├── v3-saas-migration.sql   ← owner_id 컬럼 + 백필
│   └── v3.1-rls.sql       ← RLS 정책
├── scripts/               ← 데이터 마이그레이션 (xlsx → DB)
└── tests/                 ← Vitest, 197 tests
```

## 환경변수

| 변수 | 위치 | 용도 |
|---|---|---|
| `SUPABASE_URL` | server | service_role client |
| `SUPABASE_SERVICE_ROLE_KEY` | server | service_role client |
| `NEXT_PUBLIC_SUPABASE_URL` | server + client | auth client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | server + client | auth client |
| `GEMINI_API_KEY` | server | AI 비서 |
| `WORKSPACE_PASSWORD` | (legacy) | 옛 HTTP Basic Auth, 현재 미사용 |
