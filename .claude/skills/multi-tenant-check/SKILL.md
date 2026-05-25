---
name: multi-tenant-check
description: 코드베이스 전체에서 owner_id 격리 누락을 감사. 새 PR이나 기능 추가 후, 또는 사용자가 데이터 격리 검증 요청 시 사용.
---

# Multi-tenant 격리 감사

owner_id 격리가 빠진 곳을 찾아 보고한다. 매번 같은 절차로 진행.

## 1. supabase lib 함수 전체 점검

```bash
cd /c/Users/leech/dev/business-os/workspace
```

`src/lib/supabase/*.ts` 각 파일에서:

```bash
# A. 모든 supabase.from('...') 호출 위치 추출
grep -n "supabase.from(" src/lib/supabase/*.ts
```

각 호출에 대해 다음 중 하나여야 한다:
- `.eq('owner_id', ownerId)` 있음 → ✓
- `'no-auth'` 분기 있음 → ✓
- 인덱스성 lookup (id로 직접 조회) + parent의 owner 검증 → ⚠ (간접 격리 — 검토 필요)
- `fetchMemberByToken` / RLS 우회 등 명시적 예외 → ✓

## 2. API route 전체 점검

```bash
grep -L "requireOwnerId" src/app/api/**/route.ts
```

위 명령이 출력하는 파일들은 **`requireOwnerId` 호출이 없는 route**.
다음만 정당한 예외:
- `/api/health`
- `/api/auth/*`
- `/api/m/*` (회원 토큰 기반)

그 외는 누락. 추가해야 함.

## 3. 페이지 server component 점검

```bash
grep -L "requireOwnerId" src/app/**/page.tsx | grep -v "/m/" | grep -v "/login" | grep -v "/signup"
```

위 list의 페이지는 owner 컨텍스트 없이 데이터 조회 가능성. 검토.

## 4. AI 비서 tools 점검

`src/lib/ai/tools.ts`의 `buildTools(ownerId)` 팩토리 내부:
- 모든 tool의 execute 콜백이 `ownerId` 클로저 캡처해야 함
- tool args 스키마(declaration.parameters)에는 ownerId 노출 X (Gemini가 우회 불가)

## 5. DB 측 RLS 확인

사용자가 Supabase SQL Editor에서 실행 요청:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

모든 사용자 데이터 테이블의 `rowsecurity = true` 여야 함.

```sql
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;
```

각 테이블에 최소 1개 policy 있어야 함.

## 6. 보고 포맷

작업 끝나면 다음 형식으로 보고:

```
## ✓ 격리 OK
- src/lib/supabase/transactions.ts (모든 함수)
- src/lib/supabase/members.ts
- ...

## ⚠ 의심 (간접 격리 또는 예외)
- src/lib/supabase/passes.ts:adjustPassCount — parent passes.owner_id 통해 격리 (OK이지만 코드 가독성↓)

## ❌ 누락
- src/app/api/foo/route.ts — requireOwnerId 없음
- src/lib/supabase/bar.ts:baz — .eq('owner_id', ownerId) 없음

## 권장 fix
1. ...
2. ...
```

## 7. 자동화 가능한 검증 (선택)

```bash
# supabase 호출 중 owner_id 필터 없는 경우 — false positive 가능
grep -A 5 "supabase.from(" src/lib/supabase/*.ts | grep -B 5 "select\|insert\|update\|delete" | grep -v "owner_id" | head -20
```

수동 검토와 함께 사용.
