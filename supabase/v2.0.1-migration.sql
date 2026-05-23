-- v2.0.1: 강사 시급을 레슨 종류별로 분리
-- 기존 default_hourly_rate (30000)는 fallback으로 유지
alter table instructors add column if not exists rate_private bigint not null default 30000;
alter table instructors add column if not exists rate_rehab bigint not null default 30000;
alter table instructors add column if not exists rate_duet bigint not null default 30000;
alter table instructors add column if not exists rate_group bigint not null default 30000;
