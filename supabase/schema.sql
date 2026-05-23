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

-- ============================================================
-- v2: 강사, 회원, 수강권 테이블
-- ============================================================

-- v2: 강사
create table if not exists instructors (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  role text not null default 'instructor' check (role in ('owner', 'instructor', 'admin')),
  employment_type text,  -- 정규/프리랜서 등 자유 텍스트
  default_hourly_rate bigint not null default 30000,  -- 원/시간
  color text,  -- UI 표시용 hex 또는 ''
  active boolean not null default true,
  created_at timestamptz default now()
);

-- v2: 회원 마스터
create table if not exists members (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  email text,
  gender text,
  birth_date date,
  address text,
  detail_address text,
  memo text,
  tier text,  -- 회원등급 (free text)
  app_connected boolean not null default false,
  registered_at date,
  last_attended_at date,
  created_at timestamptz default now()
);

create unique index if not exists members_phone_uniq on members (phone) where phone is not null;
create index if not exists members_name_idx on members (name);

-- v2: 회원의 수강권 이력 (1 row per 결제)
create table if not exists passes (
  id bigint generated always as identity primary key,
  member_id bigint not null references members(id) on delete cascade,
  instructor_id bigint references instructors(id) on delete set null,
  pass_name text not null,        -- 체험/개인/재활/3:1소그룹 등
  pass_type text,                  -- 프라이빗/그룹
  start_date date,
  end_date date,
  total_count int,
  remaining_count int,
  available_count int,
  cancellable_count int,
  status text,                     -- 이용중/이용만료 등
  payment_type text,               -- 신규결제/재결제
  payment_amount bigint,           -- 원
  paid_at date,
  payment_method text,             -- 카드/계좌이체/현금
  installment text,                -- 일시불/N개월
  is_family boolean default false,
  issued_at date,
  last_modified_at date,
  created_at timestamptz default now()
);

create index if not exists passes_member_idx on passes (member_id);
create index if not exists passes_paid_at_idx on passes (paid_at);
create index if not exists passes_payment_type_idx on passes (payment_type);

-- v2.0.1: 강사 시급을 레슨 종류별로 분리
alter table instructors add column if not exists rate_private bigint not null default 30000;
alter table instructors add column if not exists rate_rehab bigint not null default 30000;
alter table instructors add column if not exists rate_duet bigint not null default 30000;
alter table instructors add column if not exists rate_group bigint not null default 30000;

-- v2.0.2: transactions에 회원·강사 연동
alter table transactions add column if not exists member_id bigint references members(id) on delete set null;
alter table transactions add column if not exists instructor_id bigint references instructors(id) on delete set null;
create index if not exists transactions_member_idx on transactions (member_id);
create index if not exists transactions_instructor_idx on transactions (instructor_id);

-- v2.1: 수강권 카탈로그 (상품 마스터)
create table if not exists pass_products (
  id bigint generated always as identity primary key,
  name text not null,                 -- 듀엣 / 재활 / 개인 / 체험 / 2:1 소그룹 등
  pass_type text not null check (pass_type in ('프라이빗','그룹')),
  duration_days int not null,         -- 유효 기간 (일)
  total_count int not null,           -- 총 횟수
  price bigint not null,              -- 판매 금액 (원)
  per_unit_price bigint,              -- 회당 가격 (계산 또는 직접)
  display_order int default 0,
  color text,                         -- UI 카드 색상
  active boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists pass_products_active_idx on pass_products (active);
