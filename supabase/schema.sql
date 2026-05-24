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

-- v2.1.1: transactions에 수강권 카탈로그 연동
alter table transactions add column if not exists pass_product_id bigint references pass_products(id) on delete set null;
create index if not exists transactions_pass_product_idx on transactions (pass_product_id);

-- v2.5: 강사 월별 급여 정산 기록
create table if not exists payroll_records (
  id bigint generated always as identity primary key,
  instructor_id bigint not null references instructors(id) on delete cascade,
  year_month text not null,  -- YYYY-MM
  private_count int not null default 0,
  rehab_count int not null default 0,
  duet_count int not null default 0,
  group_count int not null default 0,
  total_amount bigint not null default 0,
  bonus bigint not null default 0,
  deduction bigint not null default 0,
  memo text,
  paid boolean not null default false,
  paid_at date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (instructor_id, year_month)
);

create index if not exists payroll_instructor_idx on payroll_records (instructor_id);
create index if not exists payroll_yearmonth_idx on payroll_records (year_month);

-- v2.2: 수업 로그 (간이) — 풀 캘린더 X, 날짜별 리스트만
create table if not exists lessons (
  id bigint generated always as identity primary key,
  pass_id bigint references passes(id) on delete set null,
  member_id bigint not null references members(id) on delete cascade,
  instructor_id bigint references instructors(id) on delete set null,
  lesson_date date not null,
  lesson_time text,  -- 'HH:MM'
  duration_minutes int default 50,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled_same_day','cancelled_advance','noshow')),
  deducted boolean not null default false,
  memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists lessons_date_idx on lessons (lesson_date);
create index if not exists lessons_member_idx on lessons (member_id);
create index if not exists lessons_instructor_idx on lessons (instructor_id);
create index if not exists lessons_pass_idx on lessons (pass_id);

-- v2.6: 메시지 발송 기록
create table if not exists message_records (
  id bigint generated always as identity primary key,
  channel text not null default 'manual' check (channel in ('manual','sms','kakao','email','webpush')),
  recipient_group text not null,  -- '전체회원' / '만료임박' / '휴면' / '강사' / '사용자정의' 등
  recipient_count int not null default 0,
  recipient_ids bigint[],  -- member.id 또는 instructor.id 목록
  subject text,
  body text not null,
  status text not null default 'draft' check (status in ('draft','sent','failed')),
  sent_at timestamptz,
  memo text,
  created_at timestamptz default now()
);

create index if not exists message_records_created_idx on message_records (created_at desc);

-- v2 추가: members에 운영자 전용 메모
alter table members add column if not exists internal_memo text;

-- v2.5.1: 급여에 사업소득세 3.3% 자동 공제 컬럼
alter table payroll_records add column if not exists tax_withholding bigint not null default 0;

-- v2.7: 회원 접근 토큰 (per-member URL access)
alter table members add column if not exists access_token text;
create unique index if not exists members_access_token_uniq on members (access_token) where access_token is not null;

-- v2.8: 그룹 수업 세션 + 예약
create table if not exists group_sessions (
  id bigint generated always as identity primary key,
  instructor_id bigint references instructors(id) on delete set null,
  session_name text not null,
  lesson_date date not null,
  lesson_time text not null,
  duration_minutes int default 50,
  capacity int not null default 4,
  notes text,
  active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists group_sessions_date_idx on group_sessions (lesson_date);
create index if not exists group_sessions_active_idx on group_sessions (active);

create table if not exists group_reservations (
  id bigint generated always as identity primary key,
  session_id bigint not null references group_sessions(id) on delete cascade,
  member_id bigint not null references members(id) on delete cascade,
  pass_id bigint references passes(id) on delete set null,
  status text not null default 'reserved' check (status in ('reserved','cancelled','attended','noshow')),
  deducted boolean not null default false,
  reserved_at timestamptz default now(),
  cancelled_at timestamptz,
  created_at timestamptz default now(),
  unique (session_id, member_id)
);
create index if not exists group_reservations_session_idx on group_reservations (session_id);
create index if not exists group_reservations_member_idx on group_reservations (member_id);

-- v2.9: 비용 카테고리 마스터 (회계 계정과목 + 설명)
create table if not exists expense_categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text,  -- 세무사가 봤을 때 이게 뭔지 알 수 있게
  classification text not null default 'living' check (classification in ('business','living','owner_draw','reserve','capital')),
  vat_deductible boolean not null default false,
  income_tax_deductible boolean not null default false,
  display_order int default 0,
  active boolean not null default true,
  is_default boolean not null default false,  -- seed 데이터 마킹용
  created_at timestamptz default now()
);
create index if not exists expense_categories_active_idx on expense_categories (active);
create index if not exists expense_categories_order_idx on expense_categories (display_order);

-- v2.9: 사업자 유형 (일반/간이)
alter table profile add column if not exists tax_payer_type text not null default 'general' check (tax_payer_type in ('general', 'simplified'));

-- v2.10: 수강권 회차 조정 이력 (보너스/차감 로그)
create table if not exists pass_adjustments (
  id bigint generated always as identity primary key,
  pass_id bigint not null references passes(id) on delete cascade,
  delta int not null,
  reason text not null,
  created_at timestamptz default now()
);
create index if not exists pass_adjustments_pass_idx on pass_adjustments (pass_id);
create index if not exists pass_adjustments_created_idx on pass_adjustments (created_at desc);

-- v2.11: AI 비서 대화 이력
create table if not exists chat_sessions (
  id bigint generated always as identity primary key,
  title text not null default '새 대화',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists chat_sessions_updated_idx on chat_sessions (updated_at desc);

create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  session_id bigint not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'model')),
  text text not null,
  tool_calls jsonb,
  created_at timestamptz default now()
);
create index if not exists chat_messages_session_idx on chat_messages (session_id, created_at);
