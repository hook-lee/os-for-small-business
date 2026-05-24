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
