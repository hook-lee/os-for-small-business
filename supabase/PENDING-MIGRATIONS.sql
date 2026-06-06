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

-- ============================================================
-- v3.7: 수강권 발급 → 가계부 매출 자동 연결
--
-- 문제:
--  - 지금까지 수강권(pass) 발급은 passes 테이블에만 기록됐고
--    가계부(transactions)에 매출이 안 생겼다.
--  - 매출 통계는 transactions만 합산 → 발급분 매출이 통째로 누락.
--    이게 "가계부 매출 < 수강권 결제" 불일치의 구조적 원인.
--
-- 해결:
--  - 수강권 발급 시 동일 결제를 transactions에 '매출'(+금액)로 자동 생성.
--  - 두 테이블을 pass_id로 연결 → 가계부 = 수강권 결제 항상 정합.
--  - 매출 통계는 여전히 transactions만 합산 (passes.payment_amount 합산 금지 규칙 유지).
--    pass_id는 "이 매출이 어느 수강권에서 왔나" 추적용일 뿐 → 이중집계 아님.
--  - 수강권 삭제 시 연결 매출도 코드에서 함께 삭제.
--    FK는 on delete set null 안전망 (직접 SQL 삭제 시에도 매출 데이터는 보존, 링크만 해제).
--
-- 과거 import분(788건)은 백필 안 함 — 가계부 xlsx에 이미 실제 매출이 들어있어
-- 백필하면 이중집계됨. 자동 연결은 "앱에서 새로 발급하는 분"부터만 적용.
--
-- 멱등: add column if not exists / create index if not exists. 여러 번 실행 OK.
-- ============================================================

alter table transactions add column if not exists pass_id bigint references passes(id) on delete set null;
create index if not exists transactions_pass_idx on transactions (pass_id) where pass_id is not null;

-- ============================================================
-- v3.8: 사업자 유형 타임라인 (원장 직접 설정)
--
-- 문제:
--  - 세금 페이지의 과세유형 전환 타임라인이 코드에 라파 필라테스 히스토리로
--    하드코딩(2024-04~2025-06 간이, 2025-07~ 일반)돼 모든 계정에 동일하게 노출됐다.
--  - "모든 데이터는 원장이 설계하기 나름" 원칙 위배 — 신규 가입자에게
--    남의 사업 히스토리가 보임.
--
-- 해결:
--  - 타임라인을 profile 컬럼 2개로 빼서 원장이 /settings에서 직접 입력.
--    · tax_start_month        : 사업 개시 연월 'YYYY-MM' (타임라인 시작점)
--    · tax_general_since_month: 간이 → 일반 전환 연월 'YYYY-MM' (없으면 단일 유형)
--  - 코드(buildTaxPeriods)는 이 두 값 + tax_payer_type로 타임라인을 생성.
--    비우면 거래 첫 달부터 현재 유형(기본 간이) 단일 구간으로 표시.
--
-- 멱등: add column if not exists. 여러 번 실행 OK.
-- ============================================================

alter table profile add column if not exists tax_start_month text;          -- 'YYYY-MM'
alter table profile add column if not exists tax_general_since_month text;   -- 'YYYY-MM' (null = 전환 없음)

-- ── 라파 필라테스 기존 타임라인 보존 (멱등: 이미 값이 있으면 덮어쓰지 않음) ──
-- 신규 가입자엔 영향 없음. workspace_name으로 라파만 타겟.
update profile
set tax_start_month         = coalesce(tax_start_month, '2024-04'),
    tax_general_since_month = coalesce(tax_general_since_month, '2025-07'),
    tax_payer_type          = 'general'
where workspace_name = '라파 필라테스';

-- ============================================================
-- v3.9: 회원별 강사 시급/인센티브 (월별 급여 정산 우선 적용)
--
-- 문제:
--  - 강사 시급은 강사 단위(개인/재활/듀엣/그룹 4종)로만 정해졌다.
--  - 실제로는 "이 회원은 이 강사한테 특별 시급" / "재등록 보상 인센티브" 처럼
--    회원×강사 단위로 금액이 달라지는 케이스가 있다.
--
-- 해결:
--  - member_instructor_rates: (회원, 강사) 쌍에 대해
--      · custom_rate            : 단일 시급(회당). null = 강사 기본 시급 사용.
--                                 값이 있으면 그 회원의 모든 수업은 카테고리 무시하고 이 시급으로 계산.
--      · incentive_per_session  : 회당 추가 인센티브(원). 기본 0.
--      · memo                   : 사유 (예: "10회 재등록 보상")
--  - 월별 급여 정산(payroll)에서 이 값이 강사 기본 시급보다 우선 적용된다.
--    급여 = (카테고리 집계 × 강사 기본시급) + 회원별 조정액
--    회원별 조정액 = Σ[(단일시급 − 기본시급)×회수 + 인센티브×회수]
--
-- 멱등: if not exists / drop policy if exists. 여러 번 실행 OK.
-- ============================================================

create table if not exists member_instructor_rates (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  member_id bigint not null references members(id) on delete cascade,
  instructor_id bigint not null references instructors(id) on delete cascade,
  custom_rate integer,                              -- null = 강사 기본 시급 사용
  incentive_per_session integer not null default 0, -- 회당 추가 인센티브
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, instructor_id)
);
create index if not exists mir_owner_idx on member_instructor_rates (owner_id);
create index if not exists mir_member_idx on member_instructor_rates (member_id);
create index if not exists mir_instructor_idx on member_instructor_rates (instructor_id);

alter table member_instructor_rates enable row level security;
drop policy if exists owner_all_select on member_instructor_rates;
drop policy if exists owner_all_insert on member_instructor_rates;
drop policy if exists owner_all_update on member_instructor_rates;
drop policy if exists owner_all_delete on member_instructor_rates;
create policy owner_all_select on member_instructor_rates for select using (auth.uid() = owner_id);
create policy owner_all_insert on member_instructor_rates for insert with check (auth.uid() = owner_id);
create policy owner_all_update on member_instructor_rates for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy owner_all_delete on member_instructor_rates for delete using (auth.uid() = owner_id);

-- 월별 급여 정산에 "회원별 시급·인센티브 조정액"을 저장 (reload 시 gross 복원용).
-- total_amount에는 이미 조정액이 반영돼 있고, adjustment는 그 내역 보존·재계산용.
alter table payroll_records add column if not exists adjustment bigint not null default 0;

-- ============================================================
-- v3.10: 종소세 인적공제 인원 (원장 직접 입력)
--
-- 의도:
--  - 인적공제는 본인 + 부양가족(소득금액 100만 이하 요건) 1인당 150만 소득공제.
--    원장마다 부양가족 수가 다르므로 코드에 하드코딩할 수 없다 → 원장이 직접 설정.
--  - 보수적 기본값 = 1 (본인만). 모르면 과소공제(세금 더 잡힘) 쪽으로 안전.
--
-- 멱등: add column if not exists. 여러 번 실행 OK.
-- ============================================================

alter table profile add column if not exists personal_deduction_count integer not null default 1;

-- ============================================================
-- v3.11: 연간 KPI 목표 (올해 목표 대시보드)
--
-- 의도:
--  - 원장이 올해 목표(연 매출·순이익·활성회원·신규회원·전환율·재등록률)를 설정하고
--    실적 대비 달성률을 /goals 대시보드에서 본다.
--  - 연도별로 다른 목표를 가지므로 jsonb { "2026": {...}, "2027": {...} } 형태로 저장.
--    각 항목 null = 미설정. 금액 원, 인원 명, 비율 0~1.
--  - 컬럼 미존재 시 앱은 graceful fallback (목표 저장만 안 됨 — 다른 기능 영향 X).
--
-- 멱등: add column if not exists. 여러 번 실행 OK.
-- ============================================================

alter table profile add column if not exists annual_goals jsonb not null default '{}'::jsonb;

-- ============================================================
-- v3.12: 예약형 수업 종류 (회원 자율예약 Phase 1)
--
-- 의도:
--  - group_sessions를 "예약형 수업" 통합 모델로 확장 (개인=정원1·듀엣=정원2·그룹=정원N).
--  - 종류(category)를 붙여 ① 회원 예약 UI 구분 ② 급여 자동집계를 종류별로(개인/재활/듀엣/그룹) 정확히.
--    (기존엔 group_sessions를 무조건 '그룹' 시급으로 집계 → 정원1 개인수업을 그룹시급으로 잘못 지급.)
--  - 기존 그룹 세션은 default '그룹'이라 동작 변화 없음.
--
-- 멱등: add column if not exists. 여러 번 실행 OK.
-- ============================================================

alter table group_sessions add column if not exists category text not null default '그룹';

-- ============================================================
-- v3.13: 잔여횟수 알림 기준 (원장 설정)
--  - 잔여 N회 이하 회원을 홈 '처리 필요'에 알림. 기본 3. 0이면 끔.
-- 멱등: add column if not exists.
-- ============================================================

alter table profile add column if not exists low_remaining_threshold integer not null default 3;

-- ============================================================
-- v3.14: 알림(종) 커스텀 설정 + 강사 월급 지급일
--  - notification_settings: 받을 알림 종류 ON/OFF (jsonb)
--  - payroll_day: 강사 월급 지급일(매월 1~31). D-1/D-day 알림용. null=미설정
-- 멱등: add column if not exists.
-- ============================================================

alter table profile add column if not exists notification_settings jsonb not null default '{}'::jsonb;
alter table profile add column if not exists payroll_day integer;

-- ============================================================
-- v3.15: 운영자 본명 카테고리 '유진 급여' → 표준 '대표자급여'
--
-- 의도:
--  - 분류 코드(Category union·classify·세무 매핑)에 운영자 본명 '유진 급여'가
--    하드코딩돼 있던 것을 generic '대표자급여'(신규 가입자 기본값과 동일)로 통일.
--    PII 제거 + 멀티테넌트 일관성.
--  - 거래 집계는 transactions.classification(이미 owner_draw) 기준이라 세무 영향 없음.
--    이 마이그는 화면에 보이는 '카테고리 이름'만 통일한다.
--  - 코드엔 '유진 급여'→'대표자급여' 입력 정규화 안전망이 있어, 이 SQL을 안 돌려도
--    세무는 안 틀어진다. 다만 기존 데이터의 표시 이름을 깔끔히 하려면 실행 권장.
--
-- 멱등: 같은 이름 중복 시 noop. 여러 번 실행 OK.
-- ============================================================

update transactions      set category     = '대표자급여' where category     = '유진 급여';
update transactions      set raw_category = '대표자급여' where raw_category = '유진 급여';
update expense_categories set name        = '대표자급여'
  where name = '유진 급여'
    and not exists (
      select 1 from expense_categories e2
      where e2.owner_id is not distinct from expense_categories.owner_id
        and e2.name = '대표자급여'
    );
