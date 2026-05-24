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
