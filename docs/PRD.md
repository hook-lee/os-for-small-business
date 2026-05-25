# Onmove PRD (Product Requirements Document)

- **최종 업데이트**: 2026-05-25
- **상태**: Multi-tenant SaaS 운영 단계
- **이전 PRD**: `docs/specs/2026-05-20-workspace-v1-design.md` (v1 single-tenant, archived)

---

## 1. 한 줄 정의

**운동 센터 사장님이 회원·강사·매출·세금을 한 곳에서 굴리고, AI 비서가 자기 데이터를 들고 상담해주는 SaaS.**

---

## 2. 사용자 (페르소나)

### 1차 ICP (현재 운영)
- **유진** (라파 필라테스 원장, 만 27세, 2024-04 창업)
- 필라테스 1인 운영, 연 매출 1~1.2억대
- 24-04~25-06 간이과세자 → 25-07~ 일반과세자 (강제 전환) → 26-07~ 간이 전환 검토 중
- 이전엔 구글 시트 + Looker Studio로 운영. xlsx (2,917건, 24-04~26-05)가 source of truth.

### 확장 ICP
- 필라테스/PT/요가 등 운동 스튜디오 1인 운영자
- 연 매출 5천만~3억대 (간이↔일반 경계 부근이 가장 가치 큼)
- 세무사는 5월 종소세 신고 때만 만남 — 평소 운영 의사결정에 세금 정보 부재

---

## 3. 핵심 기능 (구현 완료)

### A. 인증 / Multi-tenant
- Supabase Auth (이메일/비밀번호)
- `/signup` 회원가입 (센터명·직급 필수, 전화·주소 선택)
- 모든 사용자 데이터에 `owner_id` 격리
- RLS 활성화 (DB 레벨 격리 강제)
- 회원 토큰 페이지(`/m/[token]`)는 인증 우회 (토큰 = 자격증명)

### B. 거래 가계부 (transactions)
- `/add` 한 줄 입력 (지출/매출, 카테고리, 금액, 수단)
- 회원·강사·수강권 같이 선택 시 → 자동 수강권 발급(passes에 row 추가)
- 카테고리 24개 default (회계 계정과목 기준) + 사용자 추가 가능

### C. 회원·강사·수강권 관리
- 회원 285명 (라파 기준, 다른 owner는 0부터 시작)
- 강사 시급 4종 (개인/재활/듀엣/그룹)
- 수강권 발급 → 자동 차감 (lesson 상태 변경 시)
- 회원 토큰 URL (카톡으로 회원에게 보냄 → 회원 페이지 접근)

### D. 수업 일정
- 개인 수업 + 그룹 수업 (group_sessions + group_reservations)
- 반복 등록 (기간 + 요일 + 시간 고정)
- 차감 룰: completed/cancelled_same_day/noshow → 차감 / scheduled/cancelled_advance → 차감 X

### E. 강사 급여
- lessons + group_sessions에서 자동 집계
- 3.3% 원천징수 자동 계산
- 강사별 월 정산

### F. 재무 대시보드
- **`/finances` (월별 요약)** — Excel 우측 패널 재현
  - 매출 / 영업이익 / 순수익 / 거래 건수 4개 KPI
  - **결제수단별 매출** (카드/계좌이체/현금) 강조
  - 사업 비용 9개 / 개인 비용 12개 분리
  - 월별 추이 차트
- **`/sales` (매출)** — passes 결제는 참고용, transactions만 source of truth
- **`/tax` (세금)** — 4섹션:
  1. 사업자 유형 타임라인 (간이→일반→간이 조건부)
  2. 간이 전환 조건 모니터링 (rolling 12개월 매출 vs 1억800만)
  3. 분기별 부가세 추이 (실측 + 추정)
  4. 과거 납부 세금 (부가세/종소세/원천세/지방세 분류)
- **`/analytics` (분석)** — 회원/강사 KPI

### G. AI 비서 (Gemini 2.5 Flash)
- 우하단 floating widget (모든 admin 페이지)
- 페이지 컨텍스트 인지 (`/tax`에서는 세금 추천 질문)
- Function Calling: 7개 tool (`searchMembers`, `getMemberDetail`, `getMonthlyFinancials`, `listInstructors`, `getInstructorPayrollPreview`, `simulateTax`, `getReserveRecommendation`)
- 대화 영속화 (chat_sessions + chat_messages Supabase)
- 회원 phone 자동 마스킹
- Rate limit (분당 10 / 시간당 60)

### H. 카테고리 가이드
- 24개 표준 회계 계정과목 (`expense_categories`)
- 사업자 입장에서 어떤 거래에 어떤 카테고리 쓰는지 설명
- is_default=true 24개는 공용, 사용자 추가분만 격리

---

## 4. 데이터 모델 (요약)

| 테이블 | 역할 | owner_id |
|---|---|---|
| profile | 사용자별 워크스페이스 (센터명/직급/세무 정보) | ✓ (직접) |
| members | 회원 | ✓ (직접) |
| instructors | 강사 | ✓ (직접) |
| passes | 회원의 활성 수강권 | ✓ (직접) |
| pass_products | 수강권 카탈로그 | ✓ (직접) |
| lessons | 개인 수업 | ✓ (직접) |
| group_sessions | 그룹 수업 세션 | ✓ (직접) |
| group_reservations | 그룹 예약 | session_id 통해 |
| payroll_records | 강사 월 급여 | ✓ (직접) |
| transactions | 거래(매출/지출) 가계부 | ✓ (직접) |
| expense_categories | 비용 카테고리 | ✓ (직접) + is_default 공용 |
| message_records | 메시지 발송 기록 | ✓ (직접) |
| pass_adjustments | 수강권 회차 조정 이력 | pass_id 통해 |
| chat_sessions | AI 비서 대화 세션 | ✓ (직접) |
| chat_messages | AI 비서 메시지 | session_id 통해 |

---

## 5. 차별점 (다른 SaaS와 비교)

| | 스튜디오메이트 | 일반 가계부 SaaS | **Onmove** |
|---|:---:|:---:|:---:|
| 회원·수강권 관리 | ✓ | X | ✓ |
| 세금 시뮬레이터 (부가세·종소세) | X | △ | **✓** |
| 간이↔일반 전환 모니터링 | X | X | **✓** |
| 강사 급여 자동 집계 | △ | X | **✓** |
| AI 비서 (데이터 들고 상담) | X | X | **✓** |
| 결제수단별 매출 분석 | △ | △ | **✓** |
| Multi-tenant 무료 | X | △ | **✓** |

---

## 6. 비기능 요구사항

### 보안
- Supabase Auth + RLS
- 보안 헤더 (CSP, HSTS, X-Frame-Options)
- Rate limit
- service_role 키 server-only

### 성능
- Transactions cache (Map 기반, owner별, 1분 TTL)
- 페이지네이션 (PostgREST 1000행 제한)
- AI 비서 Gemini 2.5 Flash (응답 1-3초)

### 가격
- 현재: 무료 (Vercel Hobby + Supabase Free + Gemini Free)
- 추후 paid 전환 시: 사용자별 결제 통합 필요

---

## 7. 로드맵 (현재 미구현)

### Phase 차세대 (요청 시)
- 비밀번호 복잡도 정책 + 2FA
- 회원 access_token 만료
- CSRF 토큰
- Audit log (누가 언제 무엇을 수정)
- Upstash Redis 기반 분산 rate limit
- 모바일 PWA
- 영수증 OCR (이미지 → 거래 자동 입력)
- 카테고리 자동 추천 (AI)
- 멤버 결제 알림 (카톡/이메일 cron)
- 강사용 별도 로그인 (role 기반 권한 분리)

---

## 8. 의사결정 원칙

1. **데이터 source of truth는 사용자 직접 입력** — 외부 import는 참고용
2. **세무 답변엔 항상 디스클레이머** — "참고용 시뮬레이션, 신고는 세무사 확인"
3. **새 사용자 onboarding은 빈 워크스페이스** — fixture/demo 데이터 자동 import X
4. **DB 마이그레이션은 멱등** — 여러 번 실행해도 안전
5. **사용자 결정 권한**: 데이터 삭제·실제 신고·결제 — 모두 사용자가 클릭해야 적용
