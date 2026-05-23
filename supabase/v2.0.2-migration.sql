-- v2.0.2: transactions에 회원·강사 연동
alter table transactions add column if not exists member_id bigint references members(id) on delete set null;
alter table transactions add column if not exists instructor_id bigint references instructors(id) on delete set null;
create index if not exists transactions_member_idx on transactions (member_id);
create index if not exists transactions_instructor_idx on transactions (instructor_id);
