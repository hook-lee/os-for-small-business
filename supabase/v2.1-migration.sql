-- v2.1: 수강권 카탈로그
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
