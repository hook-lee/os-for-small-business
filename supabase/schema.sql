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
