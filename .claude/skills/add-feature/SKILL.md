---
name: add-feature
description: Onmove에 새 기능 (DB 테이블 + lib + API + UI) 추가 시 multi-tenant 룰을 따르도록 가이드. 새 컬럼/테이블/페이지를 만들 때 사용.
---

# Onmove 새 기능 추가 절차

새 기능 만들기 전 이 체크리스트를 순서대로 진행한다.

## 1. 데이터 모델 결정

새 데이터가 사용자별로 분리되어야 하면 → **`owner_id uuid references auth.users(id) on delete cascade`** 필수.

```sql
-- 마이그레이션 SQL (supabase/PENDING-MIGRATIONS.sql 또는 별도 v3.x SQL)
create table if not exists my_new_table (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users(id) on delete cascade,  -- ← 필수
  -- ... 다른 필드들
  created_at timestamptz default now()
);
create index if not exists my_new_table_owner_idx on my_new_table (owner_id);

-- RLS policy 추가 (v3.1-rls.sql 패턴 따름)
alter table my_new_table enable row level security;
create policy owner_all_select on my_new_table for select using (auth.uid() = owner_id);
create policy owner_all_insert on my_new_table for insert with check (auth.uid() = owner_id);
create policy owner_all_update on my_new_table for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy owner_all_delete on my_new_table for delete using (auth.uid() = owner_id);
```

## 2. lib 함수 작성 (`src/lib/supabase/my-table.ts`)

```typescript
import { getSupabaseClient } from './client'

export interface MyEntity {
  id: number
  ownerId: string
  // ...
}

interface MyEntityRow {
  id: number
  owner_id: string
  // ...
}

function rowToEntity(r: MyEntityRow): MyEntity {
  return { id: r.id, ownerId: r.owner_id /* ... */ }
}

export async function fetchAll(ownerId: string): Promise<MyEntity[]> {
  const supabase = getSupabaseClient()
  let q = supabase.from('my_new_table').select('*')
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)   // ← 필수
  const { data, error } = await q
  if (error) throw new Error(`fetch failed: ${error.message}`)
  return ((data ?? []) as MyEntityRow[]).map(rowToEntity)
}

export async function insertOne(input: { /* fields */ }, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = { /* fields */ }
  if (ownerId !== 'no-auth') row.owner_id = ownerId   // ← 필수
  const { data, error } = await supabase.from('my_new_table').insert(row).select('id').single()
  if (error) throw new Error(`insert failed: ${error.message}`)
  return (data as { id: number }).id
}

export async function updateOne(id: number, patch: Partial<MyEntity>, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  let q = supabase.from('my_new_table').update({ /* mapped */ }).eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)   // ← 방어
  const { error } = await q
  if (error) throw new Error(`update failed: ${error.message}`)
}

export async function deleteOne(id: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  let q = supabase.from('my_new_table').delete().eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)   // ← 방어
  const { error } = await q
  if (error) throw new Error(`delete failed: ${error.message}`)
}
```

## 3. API route 작성 (`src/app/api/my-resource/route.ts`)

```typescript
import { NextResponse } from 'next/server'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { fetchAll, insertOne } from '@/lib/supabase/my-table'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const items = await fetchAll(ownerId)
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json()
    const id = await insertOne(body, ownerId)
    return NextResponse.json({ id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
```

## 4. UI 페이지 (`src/app/my-page/page.tsx`)

```typescript
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { fetchAll } from '@/lib/supabase/my-table'
import { MyClientComponent } from './MyClientComponent'

export const dynamic = 'force-dynamic'

export default async function MyPage() {
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  const items = await fetchAll(ownerId)
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">제목</h2>
      <MyClientComponent initial={items} />
    </div>
  )
}
```

## 5. 테스트 (`tests/lib/supabase/my-table.test.ts` 또는 도메인 lib)

순수 함수는 단위 테스트. supabase 직접 호출은 통합 테스트 또는 mock.

## 6. 검증

```bash
cd /c/Users/leech/dev/business-os/workspace
npx tsc --noEmit               # 0 errors
npx vitest run --reporter=dot  # all pass
npx next build                 # success
```

## 7. 사용자 액션 (DB 마이그레이션 안내)

새 테이블/컬럼 추가 시 SQL은 사용자가 Supabase SQL Editor에서 직접 실행. 안내 메시지에:
- 정확한 SQL (멱등 패턴)
- 검증 쿼리
- 무엇이 추가되는지 한 줄 설명

## ❌ 흔한 실수

1. `owner_id` 필터 빼먹음 → 다른 owner 데이터 leak
2. RLS policy 누락 → anon key 직접 접근 시 격리 안 됨
3. `ownerId === 'no-auth'` 체크 없이 무조건 필터 → 로컬 dev 모드에서 깨짐
4. API route에서 `requireOwnerId` 없이 lib 호출 → 누구나 호출 가능
5. update/delete에서 owner_id 조건 누락 → 다른 owner row 만질 수 있음
