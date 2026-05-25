-- ============================================================
-- v3.0: Multi-tenant SaaS 전환
--
-- 변경:
-- 1. 모든 사용자 데이터 테이블에 owner_id uuid references auth.users 추가
-- 2. 기존 데이터(원래 단일 운영자 가정)를 raphapilatesyj@gmail.com 계정에 귀속
-- 3. 인덱스 추가 (owner_id 기반 쿼리 최적화)
-- 4. members.phone unique는 owner별로 격리 (다른 사용자가 같은 번호 회원 등록 가능)
-- 5. profile은 owner당 1행 (unique index 추가)
-- 6. expense_categories: is_default=true는 공용 (owner_id NULL), 사용자 추가분만 owner 귀속
--
-- 사전 조건:
-- raphapilatesyj@gmail.com 계정이 Supabase Authentication → Users에 미리 생성되어 있어야 함.
-- 없으면 RAISE EXCEPTION으로 중단.
--
-- 안전성:
-- - IF NOT EXISTS / WHERE owner_id IS NULL 패턴 → 여러 번 실행 OK
-- - on delete cascade: auth 계정 삭제 시 데이터도 같이 삭제 (이건 신중. 운영자는 절대 auth.users에서 직접 지우지 말 것)
-- ============================================================

do $$
declare
  rapha_uid uuid;
begin
  -- raphapilatesyj 계정 UUID 확보
  select id into rapha_uid from auth.users where email = 'raphapilatesyj@gmail.com';
  if rapha_uid is null then
    raise exception '❌ raphapilatesyj@gmail.com 계정이 auth.users에 없습니다. Supabase Authentication → Users에서 먼저 만들어주세요.';
  end if;
  raise notice '✓ rapha owner_id: %', rapha_uid;

  -- 1. owner_id 컬럼 추가 (12개 테이블)
  alter table transactions       add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table members            add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table instructors        add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table passes             add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table pass_products      add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table lessons            add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table group_sessions     add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table payroll_records    add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table expense_categories add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table message_records    add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table chat_sessions      add column if not exists owner_id uuid references auth.users(id) on delete cascade;
  alter table profile            add column if not exists owner_id uuid references auth.users(id) on delete cascade;

  -- 2. 기존 데이터 백필 (NULL인 row만 — 멱등)
  update transactions       set owner_id = rapha_uid where owner_id is null;
  update members            set owner_id = rapha_uid where owner_id is null;
  update instructors        set owner_id = rapha_uid where owner_id is null;
  update passes             set owner_id = rapha_uid where owner_id is null;
  update pass_products      set owner_id = rapha_uid where owner_id is null;
  update lessons            set owner_id = rapha_uid where owner_id is null;
  update group_sessions     set owner_id = rapha_uid where owner_id is null;
  update payroll_records    set owner_id = rapha_uid where owner_id is null;
  update message_records    set owner_id = rapha_uid where owner_id is null;
  update chat_sessions      set owner_id = rapha_uid where owner_id is null;
  update profile            set owner_id = rapha_uid where owner_id is null;

  -- expense_categories: is_default=true(시드 24개)는 공용으로 유지, 사용자 추가분만 owner_id 부여
  update expense_categories set owner_id = rapha_uid
   where owner_id is null and is_default = false;

  raise notice '✓ 기존 데이터 raphapilatesyj@gmail.com에 귀속 완료';
end $$;

-- 3. 인덱스 (owner_id 기반 쿼리 최적화)
create index if not exists transactions_owner_idx       on transactions (owner_id);
create index if not exists members_owner_idx            on members (owner_id);
create index if not exists instructors_owner_idx        on instructors (owner_id);
create index if not exists passes_owner_idx             on passes (owner_id);
create index if not exists pass_products_owner_idx      on pass_products (owner_id);
create index if not exists lessons_owner_idx            on lessons (owner_id);
create index if not exists group_sessions_owner_idx     on group_sessions (owner_id);
create index if not exists payroll_records_owner_idx    on payroll_records (owner_id);
create index if not exists expense_categories_owner_idx on expense_categories (owner_id);
create index if not exists message_records_owner_idx    on message_records (owner_id);
create index if not exists chat_sessions_owner_idx      on chat_sessions (owner_id);

-- 4. profile: owner당 1행 (unique)
create unique index if not exists profile_owner_uniq on profile (owner_id);

-- 5. members.phone unique는 owner별로 격리
--    (글로벌 unique 제거 → owner_id 포함 복합 unique)
drop index if exists members_phone_uniq;
create unique index if not exists members_phone_owner_uniq
  on members (owner_id, phone) where phone is not null;

-- 6. payroll_records.unique (instructor_id, year_month) — instructor_id가 owner별로 다르니
--    자동 격리됨. 별도 작업 X.

-- ============================================================
-- 검증 쿼리 (실행 후 결과 확인용)
-- ============================================================
-- select 'transactions' as tbl, count(*) filter (where owner_id is null) as null_count, count(*) as total from transactions
-- union all select 'members', count(*) filter (where owner_id is null), count(*) from members
-- union all select 'instructors', count(*) filter (where owner_id is null), count(*) from instructors
-- union all select 'passes', count(*) filter (where owner_id is null), count(*) from passes
-- union all select 'pass_products', count(*) filter (where owner_id is null), count(*) from pass_products
-- union all select 'lessons', count(*) filter (where owner_id is null), count(*) from lessons
-- union all select 'group_sessions', count(*) filter (where owner_id is null), count(*) from group_sessions
-- union all select 'payroll_records', count(*) filter (where owner_id is null), count(*) from payroll_records
-- union all select 'expense_categories (user)', count(*) filter (where owner_id is null and is_default = false), count(*) filter (where is_default = false) from expense_categories
-- union all select 'message_records', count(*) filter (where owner_id is null), count(*) from message_records
-- union all select 'chat_sessions', count(*) filter (where owner_id is null), count(*) from chat_sessions
-- union all select 'profile', count(*) filter (where owner_id is null), count(*) from profile;
--
-- → null_count가 모두 0이어야 정상
