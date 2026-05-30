-- v3.3: 스튜디오 운영 설정 (jsonb 1개로 자유 확장 가능)
--
-- owner_id를 PK로 사용 (owner당 1행). 새 사용자 가입 시 자동 생성 X — 첫 저장 시 INSERT.
-- settings는 jsonb로 17개+ 설정 자유 저장. 명시적 컬럼 X로 마이그레이션 부담 0.

create table if not exists studio_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}',
  updated_at timestamptz default now()
);

create index if not exists studio_settings_updated_idx on studio_settings (updated_at desc);

-- RLS
alter table studio_settings enable row level security;

drop policy if exists owner_select on studio_settings;
drop policy if exists owner_insert on studio_settings;
drop policy if exists owner_update on studio_settings;
drop policy if exists owner_delete on studio_settings;

create policy owner_select on studio_settings for select using (auth.uid() = owner_id);
create policy owner_insert on studio_settings for insert with check (auth.uid() = owner_id);
create policy owner_update on studio_settings for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy owner_delete on studio_settings for delete using (auth.uid() = owner_id);
