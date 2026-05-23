-- ============================================================
-- 워크스페이스 v2 스키마: 강사 / 회원 / 수강권
-- Supabase SQL Editor에 붙여넣기 하세요.
-- (기존 v1 transactions / profile 테이블에 영향 없음)
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
