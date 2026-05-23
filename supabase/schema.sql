-- 워크스페이스 v1 transactions table
create table if not exists transactions (
  id bigint generated always as identity primary key,
  date date not null,
  raw_category text not null,
  category text not null,
  amount bigint not null,           -- 원 단위, 부호로 매출(+)/지출(-)
  method text not null check (method in ('카드','계좌이체','현금')),
  counterparty text,
  person text,
  classification text not null check (classification in ('business','living','owner_draw','reserve','capital')),
  memo text,
  created_at timestamptz default now()
);

create index if not exists transactions_date_idx on transactions (date);

-- 사용자 프로필 (단일 행 — id=1만 허용)
create table if not exists profile (
  id int primary key default 1 check (id = 1),
  birth_date date,
  business_address text,
  is_young_startup_eligible boolean not null default false,
  young_startup_reduction_rate numeric not null default 0,
  noranusan_annual_contribution bigint not null default 0,
  pension_annual_contribution bigint not null default 0,
  updated_at timestamptz default now()
);

-- 빈 row 1개 세팅 (없으면 생성)
insert into profile (id) values (1) on conflict (id) do nothing;
