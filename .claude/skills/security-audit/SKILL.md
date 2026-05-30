---
name: security-audit
description: Onmove 코드베이스 보안 점검. npm audit, XSS surface, env 누출, service_role 위치, RLS 상태 등 OWASP Top 10 기반 점검. /plugin install security-guidance 대안.
---

# Onmove 보안 감사 절차

`/plugin install security-guidance`가 안 되는 환경에서 동일/유사한 검사를 수동으로.

## 1. Dependency 취약점

```bash
cd /c/Users/leech/dev/business-os/workspace
npm audit
```

분류:
- **high/critical** → 즉시 fix 시도 (`npm audit fix`) 또는 대체 라이브러리 검토
- **moderate** → 사용 위치 확인. 런타임(production)에 노출되나 아니면 빌드 도구만?
- **low** → 다음 wave에 정리

**현재 알려진 issue** (2026-05-25):
- `xlsx` high (Prototype Pollution + ReDoS) — `scripts/`에서만 사용. 마이그레이션 끝나면 devDep으로 옮기거나 제거 가능.
- `next` moderate via `postcss` — 새 next 버전 release 시 자동 fix 기대

## 2. XSS Surface

```bash
grep -rn "dangerouslySetInnerHTML" src --include="*.tsx"
```

각 위치마다 확인:
- 입력값이 사용자 통제 가능한가? (input/textarea/AI 응답 등) → escape 필수
- escape 함수 통과하나? → `renderSafeMarkdown` 또는 `renderSafeBold` from `@/lib/security/sanitize`
- 그렇지 않다면 — 즉시 fix

원시 escape 패턴 (`text.replace(/\*\*/g, ...)` 직접) 발견 시 → 공통 함수로 교체.

## 3. service_role 키 위치

```bash
grep -rn "service_role\|SERVICE_ROLE\|supabaseAdmin\|getSupabaseClient" src --include="*.ts" --include="*.tsx"
```

`getSupabaseClient` (= service_role)는 **server-side만**. 다음 위치만 정당:
- `src/lib/supabase/*.ts` (server lib)
- `src/app/api/**/route.ts` (server route)
- `src/app/**/page.tsx` (server component)
- `scripts/*.mjs` (CLI)

client component (`'use client'`) 에서 호출 → **즉시 이슈**.

## 4. 환경변수 누출

```bash
grep -rn "process.env" src --include="*.ts" --include="*.tsx"
```

`NEXT_PUBLIC_*` 외 env 변수가 client component에 있는지 확인.

```bash
# .env.local이 git에 안 올라가는지
cat .gitignore | grep -E "env|\.local"
```

`.env*.local` 패턴 있어야.

## 5. 인증 / 권한

```bash
# requireOwnerId 없는 API route
grep -L "requireOwnerId" src/app/api/**/route.ts | grep -v "auth/\|health\|/m/"
```

위 list가 비어있어야 (또는 의도된 예외만).

`multi-tenant-check` 스킬 + `tenant-auditor` agent 참고.

## 6. Rate Limit

```bash
grep -rn "checkRateLimit" src --include="*.ts"
```

다음 endpoint에 rate limit 있어야:
- `/api/chat` (사용자별)
- `/api/auth/signup-check` (IP 기반)
- ⬜ 다른 비싼 endpoint? (OCR API 추가 시)

## 7. CSP / 보안 헤더

`middleware.ts`의 `applySecurityHeaders` 확인:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: 카메라/마이크/위치/결제 차단
- HSTS: 31536000+
- CSP: connect-src에 외부 도메인 화이트리스트만

## 8. RLS 상태 (Supabase)

사용자에게 SQL 실행 요청:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;

select tablename, count(*) as policy_count
from pg_policies where schemaname = 'public'
group by tablename order by tablename;
```

모든 user data 테이블의 `rowsecurity = true` + 최소 1 policy.

## 9. 에러 메시지 leak

```bash
# DB 에러 message가 client에 그대로 노출되는 곳
grep -rn "error.message\|error as Error" src/app/api --include="*.ts" | grep "NextResponse\|json"
```

DB 구조 leak 가능한 에러 (column / constraint / table name) — server log로만, client에는 일반화된 메시지.

## 10. AI Prompt Injection

AI 비서가 사용자 입력을 system prompt에 직접 삽입하면 injection 위험.

`src/lib/ai/system-prompt.ts` 검토:
- 사용자 입력은 user role 메시지로만
- workspace name, page label 등 동적 컨텍스트는 sanitize 또는 escape
- AI 응답이 다음 tool call 시 직접 인자로 들어가는지

## 11. 보고 포맷

```
# 보안 점검 보고서 (YYYY-MM-DD)

## 🚨 즉시 fix 필요
- [위치]: [문제] / [권장 조치]

## ⚠️ 검토 권장
- ...

## ✅ OK
- npm audit: N vulnerabilities (low/moderate, 영향 없음)
- XSS surface: N개 dangerouslySetInnerHTML, 모두 escape 통과
- service_role: server-only ✓
- ...

## 사용자 액션 권장
1. Supabase에서 SQL 실행으로 RLS 검증
2. .env.local이 git ignore 되는지 확인
3. ...
```
