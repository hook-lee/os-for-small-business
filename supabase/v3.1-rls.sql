-- ============================================================
-- v3.1: Row Level Security 활성화 (DB 레벨 격리)
--
-- 효과:
-- - 우리 앱은 service_role을 써서 자동 RLS 우회 → 기능 영향 X
-- - 누가 anon key로 직접 접근해도 자기 owner_id 데이터만 보임
-- - 코드 버그로 owner_id 필터 빼먹어도 DB가 막아줌 (안전망)
--
-- 멱등: 정책 drop → create 패턴이라 여러 번 실행 OK
-- ============================================================

-- ── 1. 직접 owner_id 격리되는 11개 테이블 ──
do $$
declare
  tbl text;
  tables text[] := array[
    'transactions', 'members', 'instructors', 'passes', 'pass_products',
    'lessons', 'group_sessions', 'payroll_records', 'message_records',
    'chat_sessions', 'profile'
  ];
begin
  foreach tbl in array tables loop
    execute format('alter table %I enable row level security', tbl);
    execute format('drop policy if exists owner_all_select on %I', tbl);
    execute format('drop policy if exists owner_all_insert on %I', tbl);
    execute format('drop policy if exists owner_all_update on %I', tbl);
    execute format('drop policy if exists owner_all_delete on %I', tbl);
    execute format($f$create policy owner_all_select on %I for select using (auth.uid() = owner_id)$f$, tbl);
    execute format($f$create policy owner_all_insert on %I for insert with check (auth.uid() = owner_id)$f$, tbl);
    execute format($f$create policy owner_all_update on %I for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id)$f$, tbl);
    execute format($f$create policy owner_all_delete on %I for delete using (auth.uid() = owner_id)$f$, tbl);
    raise notice '✓ RLS enabled: %', tbl;
  end loop;
end $$;

-- ── 2. expense_categories: is_default=true는 공용 ──
alter table expense_categories enable row level security;
drop policy if exists categories_select on expense_categories;
drop policy if exists categories_insert on expense_categories;
drop policy if exists categories_update on expense_categories;
drop policy if exists categories_delete on expense_categories;

create policy categories_select on expense_categories
  for select using (is_default = true or auth.uid() = owner_id);
create policy categories_insert on expense_categories
  for insert with check (auth.uid() = owner_id and is_default = false);
create policy categories_update on expense_categories
  for update using (auth.uid() = owner_id and is_default = false)
  with check (auth.uid() = owner_id and is_default = false);
create policy categories_delete on expense_categories
  for delete using (auth.uid() = owner_id and is_default = false);

-- ── 3. 간접 격리 — parent 테이블 통해 ──
-- group_reservations (group_sessions 통해)
alter table group_reservations enable row level security;
drop policy if exists reservations_select on group_reservations;
drop policy if exists reservations_insert on group_reservations;
drop policy if exists reservations_update on group_reservations;
drop policy if exists reservations_delete on group_reservations;

create policy reservations_select on group_reservations
  for select using (exists (select 1 from group_sessions s where s.id = group_reservations.session_id and s.owner_id = auth.uid()));
create policy reservations_insert on group_reservations
  for insert with check (exists (select 1 from group_sessions s where s.id = group_reservations.session_id and s.owner_id = auth.uid()));
create policy reservations_update on group_reservations
  for update using (exists (select 1 from group_sessions s where s.id = group_reservations.session_id and s.owner_id = auth.uid()));
create policy reservations_delete on group_reservations
  for delete using (exists (select 1 from group_sessions s where s.id = group_reservations.session_id and s.owner_id = auth.uid()));

-- pass_adjustments (passes 통해)
alter table pass_adjustments enable row level security;
drop policy if exists adjustments_select on pass_adjustments;
drop policy if exists adjustments_insert on pass_adjustments;
drop policy if exists adjustments_update on pass_adjustments;
drop policy if exists adjustments_delete on pass_adjustments;

create policy adjustments_select on pass_adjustments
  for select using (exists (select 1 from passes p where p.id = pass_adjustments.pass_id and p.owner_id = auth.uid()));
create policy adjustments_insert on pass_adjustments
  for insert with check (exists (select 1 from passes p where p.id = pass_adjustments.pass_id and p.owner_id = auth.uid()));
create policy adjustments_update on pass_adjustments
  for update using (exists (select 1 from passes p where p.id = pass_adjustments.pass_id and p.owner_id = auth.uid()));
create policy adjustments_delete on pass_adjustments
  for delete using (exists (select 1 from passes p where p.id = pass_adjustments.pass_id and p.owner_id = auth.uid()));

-- chat_messages (chat_sessions 통해)
alter table chat_messages enable row level security;
drop policy if exists messages_select on chat_messages;
drop policy if exists messages_insert on chat_messages;
drop policy if exists messages_update on chat_messages;
drop policy if exists messages_delete on chat_messages;

create policy messages_select on chat_messages
  for select using (exists (select 1 from chat_sessions s where s.id = chat_messages.session_id and s.owner_id = auth.uid()));
create policy messages_insert on chat_messages
  for insert with check (exists (select 1 from chat_sessions s where s.id = chat_messages.session_id and s.owner_id = auth.uid()));
create policy messages_update on chat_messages
  for update using (exists (select 1 from chat_sessions s where s.id = chat_messages.session_id and s.owner_id = auth.uid()));
create policy messages_delete on chat_messages
  for delete using (exists (select 1 from chat_sessions s where s.id = chat_messages.session_id and s.owner_id = auth.uid()));

-- ── 검증 (실행 후 결과 확인용 주석) ──
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
-- → 모든 table의 rowsecurity가 true여야 함
