-- ============================================================
-- 워크스페이스 v2.0.1 ~ v2.1 통합 마이그레이션
-- 외출 동안 빌드한 3개 wave (v2.0.2, v2.1, v2.4)에 필요한 SQL.
-- Supabase SQL Editor에 통째 붙여넣고 한 번에 Run 하세요.
-- 모두 idempotent (if not exists / add column if not exists) — 여러 번 실행 무관.
-- ============================================================

-- ── v2.0.1: 강사 시급을 레슨 종류별로 분리 ──
alter table instructors add column if not exists rate_private bigint not null default 30000;
alter table instructors add column if not exists rate_rehab   bigint not null default 30000;
alter table instructors add column if not exists rate_duet    bigint not null default 30000;
alter table instructors add column if not exists rate_group   bigint not null default 30000;

-- ── v2.0.2: transactions에 회원·강사 연동 ──
alter table transactions add column if not exists member_id     bigint references members(id)     on delete set null;
alter table transactions add column if not exists instructor_id bigint references instructors(id) on delete set null;
create index if not exists transactions_member_idx     on transactions (member_id);
create index if not exists transactions_instructor_idx on transactions (instructor_id);

-- ── v2.1: 수강권 카탈로그 (상품 마스터) ──
create table if not exists pass_products (
  id bigint generated always as identity primary key,
  name text not null,
  pass_type text not null check (pass_type in ('프라이빗','그룹')),
  duration_days int not null,
  total_count int not null,
  price bigint not null,
  per_unit_price bigint,
  display_order int default 0,
  color text,
  active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists pass_products_active_idx on pass_products (active);

-- ── v2.1.1: transactions에 수강권 카탈로그 연동 ──
alter table transactions add column if not exists pass_product_id bigint references pass_products(id) on delete set null;
create index if not exists transactions_pass_product_idx on transactions (pass_product_id);
