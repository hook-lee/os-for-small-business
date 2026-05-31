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
  delta int not null,            -- +N (보너스) / -N (차감)
  reason text not null,           -- 사유 (예: 신규 10회 결제 서비스)
  created_at timestamptz default now()
);
create index if not exists pass_adjustments_pass_idx on pass_adjustments (pass_id);
create index if not exists pass_adjustments_created_idx on pass_adjustments (created_at desc);

-- v2.11: AI 비서 대화 이력 (Gemini chat sessions + messages)
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
  tool_calls jsonb,                  -- [{name, args}] 또는 null
  created_at timestamptz default now()
);
create index if not exists chat_messages_session_idx on chat_messages (session_id, created_at);

-- ============================================================
-- v3.4: 룸 (수업 공간) 관리
--
-- 의도:
--  - 운영자가 룸 N개 등록 (라파=필라테스 A실/B실 등) 후
--    수업 추가시 룸 선택 → 동일 룸·동일 시간 중복 차단.
--  - 멀티테넌트 SaaS — owner_id 격리, RLS 정책 포함.
--
-- 멱등: if not exists / drop policy if exists → 여러 번 실행 OK.
-- ============================================================

create table if not exists rooms (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists rooms_owner_idx on rooms (owner_id);
create index if not exists rooms_active_idx on rooms (owner_id, is_active);

-- lessons / group_sessions에 room_id FK 추가
alter table lessons        add column if not exists room_id bigint references rooms(id) on delete set null;
alter table group_sessions add column if not exists room_id bigint references rooms(id) on delete set null;

-- 동일 룸·날짜·시간 중복 차단 (room_id NOT NULL인 경우만)
-- 단, 같은 룸+시간에 individual 1개, group 1개 동시 충돌은 application layer에서 검증
-- (다른 테이블이라 DB constraint로 못 잡음)
create unique index if not exists lessons_room_time_unique
  on lessons (room_id, lesson_date, lesson_time)
  where room_id is not null;
create unique index if not exists group_sessions_room_time_unique
  on group_sessions (room_id, lesson_date, lesson_time)
  where room_id is not null;

-- ── RLS 활성화 + 정책 (owner_id 격리, 표준 패턴) ──
alter table rooms enable row level security;
drop policy if exists owner_all_select on rooms;
drop policy if exists owner_all_insert on rooms;
drop policy if exists owner_all_update on rooms;
drop policy if exists owner_all_delete on rooms;
create policy owner_all_select on rooms for select using (auth.uid() = owner_id);
create policy owner_all_insert on rooms for insert with check (auth.uid() = owner_id);
create policy owner_all_update on rooms for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy owner_all_delete on rooms for delete using (auth.uid() = owner_id);

-- ── 시드: 기존 사용자별 '메인실' 1개 자동 생성 (멱등) ──
insert into rooms (owner_id, name, display_order)
select distinct owner_id, '메인실', 0
from (
  select owner_id from lessons        where owner_id is not null
  union
  select owner_id from group_sessions where owner_id is not null
  union
  select owner_id from members        where owner_id is not null
) u
where not exists (
  select 1 from rooms r where r.owner_id = u.owner_id
);

-- ============================================================
-- v3.5: 상담 + 수강권 변경 이력
--
-- 1) consultations: 신규/잠재 회원 상담 기록 (회원 전환 추적)
-- 2) pass_events: 수강권 발급·변경·만료 audit log
--
-- 멱등: if not exists / drop policy if exists. 여러 번 실행 OK.
-- ============================================================

-- 1) 상담 고객
create table if not exists consultations (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  member_id bigint references members(id) on delete set null,  -- 회원 전환 시 매핑
  name text not null,
  phone text,
  consultation_date date not null,
  inflow_channel text,           -- '방문상담' / '전화' / '카톡' 등 자유
  content text,
  staff_name text,                -- 담당스태프 (강사 또는 외부)
  staff_id bigint references instructors(id) on delete set null,
  converted_to_member boolean not null default false,
  memo text,
  created_at timestamptz default now()
);
create index if not exists consultations_owner_idx on consultations (owner_id);
create index if not exists consultations_date_idx on consultations (consultation_date desc);
create index if not exists consultations_member_idx on consultations (member_id);

alter table consultations enable row level security;
drop policy if exists owner_all_select on consultations;
drop policy if exists owner_all_insert on consultations;
drop policy if exists owner_all_update on consultations;
drop policy if exists owner_all_delete on consultations;
create policy owner_all_select on consultations for select using (auth.uid() = owner_id);
create policy owner_all_insert on consultations for insert with check (auth.uid() = owner_id);
create policy owner_all_update on consultations for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy owner_all_delete on consultations for delete using (auth.uid() = owner_id);

-- 2) 수강권 변경 이력 (audit log)
--    event_type: issued / modified / expired / deleted
--    before_data, after_data: { "전체횟수": "10", "이용시작일": "2026-01-02", ... }
--    source: 'app' (앱 내 변경) / 'import' (xlsx import) / 'trigger' (DB)
create table if not exists pass_events (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  pass_id bigint references passes(id) on delete cascade,
  member_id bigint references members(id) on delete cascade,
  member_name text not null,        -- raw name (회원 매칭 안 됐을 때도 보존)
  pass_name text,
  event_type text not null check (event_type in ('issued','modified','expired','deleted')),
  changed_at timestamptz not null,
  changed_by text,                  -- '김유진' 같은 raw text
  changed_by_id bigint references instructors(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  source text default 'app',
  created_at timestamptz default now()
);
create index if not exists pass_events_owner_idx on pass_events (owner_id);
create index if not exists pass_events_member_idx on pass_events (member_id);
create index if not exists pass_events_pass_idx on pass_events (pass_id);
create index if not exists pass_events_changed_at_idx on pass_events (changed_at desc);
-- 멱등 import용 중복 체크 인덱스 (owner + member_name + changed_at + event_type)
create unique index if not exists pass_events_import_uniq
  on pass_events (owner_id, member_name, changed_at, event_type)
  where source = 'import';

alter table pass_events enable row level security;
drop policy if exists owner_all_select on pass_events;
drop policy if exists owner_all_insert on pass_events;
drop policy if exists owner_all_update on pass_events;
drop policy if exists owner_all_delete on pass_events;
create policy owner_all_select on pass_events for select using (auth.uid() = owner_id);
create policy owner_all_insert on pass_events for insert with check (auth.uid() = owner_id);
create policy owner_all_update on pass_events for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy owner_all_delete on pass_events for delete using (auth.uid() = owner_id);

-- ============================================================
-- v3.6: 수강권 상위 카테고리
--
-- pass_products.category 추가. 사용자 자유 입력 (예: '체험'/'프라이빗'/'그룹'/'재활').
-- UI에서 카테고리 기준으로 그룹화 표시. 같은 카테고리 내 색·이름 자유.
-- NULL 허용 — 기존 데이터 영향 없음. UI는 NULL이면 name 기준 그룹화 fallback.
-- ============================================================

alter table pass_products add column if not exists category text;
create index if not exists pass_products_category_idx on pass_products (category) where category is not null;
