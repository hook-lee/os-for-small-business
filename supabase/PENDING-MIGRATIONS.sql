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
