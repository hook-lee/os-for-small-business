# Onmove — IA (Information Architecture)

> **목적**: 사이트의 정보 구조 / 페이지 트리 / 데이터 흐름을 한눈에. 새 페이지 만들기 전 여기서 정합성 확인.

---

## 1. 사이트맵 (전체 페이지 트리)

```
Onmove
├── (랜딩/인증)
│   ├── /login                              # 비인증 — 로그인 + 좌측 기능 소개
│   └── /signup                             # 비인증 — 가입 (센터명·직급 필수)
│
├── / (홈)                                  # 인증 — 운영 대시보드 (오늘/이번달 요약)
│
├── /lessons                                # 수업
│   ├── /lessons                            # 개인 수업 캘린더
│   └── /lessons/groups                     # 그룹 세션
│       └── /lessons/groups/[id]            # 세션 명단 (예약 관리)
│
├── /members                                # 회원
│   ├── /members                            # 회원 목록 (검색 + KPI)
│   └── /members/[id]                       # 회원 상세 (수강권/메모/편집)
│
├── /instructors                            # 강사
│   ├── /instructors                        # 강사 목록 + 시급 + 월 급여 미리계산
│   └── /instructors/[id]                   # 강사 상세
│
├── /finances                               # 재무 (탭 구조)
│   ├── /add                                # 거래 입력
│   ├── /finances                           # 월별 요약 (Excel 우측 패널)
│   ├── /sales                              # 매출 리포트
│   ├── /tax                                # 세금 (타임라인 + 시뮬레이터)
│   ├── /analytics                          # 분석 (회원/강사 KPI)
│   └── /finances/categories                # 카테고리 관리
│
├── /pass-products                          # 수강권 카탈로그
├── /messages                               # 메시지 발송
├── /payroll                                # 강사 급여 정산
├── /settings                               # 워크스페이스 설정
│
├── /assistant                              # AI 비서 풀스크린 (대안 UI)
│
├── /m/[token]/...                          # 회원 토큰 페이지 (별도 chrome)
│   ├── /m/[token]                          # 회원 홈
│   ├── /m/[token]/passes                   # 활성 수강권
│   ├── /m/[token]/lessons                  # 다가오는 수업
│   └── /m/[token]/group                    # 그룹 예약
│
└── /api/...                                # API routes (UI 없음)
    ├── /api/auth/{signout, signup-check}
    ├── /api/transactions/...
    ├── /api/members/[id]/...
    ├── /api/instructors/[id]/...
    ├── /api/passes/[id]/{bonus, ...}
    ├── /api/lessons/{bulk, [id]}
    ├── /api/group-sessions/{bulk, [id]}
    ├── /api/group-reservations/[id]
    ├── /api/pass-products/[id]
    ├── /api/payroll/{auto}
    ├── /api/categories/[id]
    ├── /api/messages
    ├── /api/profile
    ├── /api/chat/sessions/[id]
    └── /api/health
```

---

## 2. 글로벌 네비게이션 (`<Nav />`)

상단 헤더 (admin only):

```
[Onmove · 라파 필라테스]    홈  수업  회원  강사  재무  ⚙   [👤 user menu]
```

| 라벨 | 경로 | 활성 조건 |
|---|---|---|
| 홈 | `/` | pathname === '/' |
| 수업 | `/lessons` | pathname.startsWith('/lessons') |
| 회원 | `/members` | startsWith('/members', '/pass-products', '/messages') |
| 강사 | `/instructors` | startsWith('/instructors') |
| 재무 | `/finances` | startsWith('/finances', '/add', '/sales', '/tax', '/analytics') |
| ⚙ | `/settings` | startsWith('/settings') |

플로팅 위젯:
- 우하단 **💬 AI 비서** 버튼 (모든 admin 페이지, 회원 페이지 제외)

회원 토큰 페이지 (`/m/[token]/*`):
- 별도 chrome, 하단 탭바 (홈/수강권/수업/그룹)

---

## 3. 페이지별 정보 구조

### `/` 홈 대시보드
- **목적**: 오늘/이번달 운영 한눈 + 즉시 액션 (거래 입력 / 수업 예약)
- 핵심 데이터: 오늘 수업 N건 / 이번달 매출 X원 / 잔여 수강권 만료임박 회원 N명
- 액션: 거래 입력 / AI 비서 / 회원 목록
- ⬜ 어떤 위젯이 더 필요? (이번달 영업이익? 다음 부가세 신고일 D-day?)

### `/finances` 월별 요약 (메인 재무 대시보드)
- **목적**: Excel 우측 패널 재현 — 한 달 운영 결과 한 화면
- 4 KPI: 매출 / 영업이익 / 순수익 / 거래 건수
- 💳 결제수단별 매출 (카드/계좌이체/현금)
- 좌: 사업 비용 9개 → 영업이익
- 우: 개인 비용 12개 → 순수익
- 차트: 매출/영업이익/순수익 월별 추이

### `/tax` 세금
- **목적**: 다음 세금 납부 시점 + 간이 전환 결정 + 절세 액션
- 4 섹션:
  1. 사업자 유형 타임라인
  2. 간이 전환 조건 모니터링 (rolling 12개월 vs 1억800만)
  3. 분기별 부가세 추이 (실측 + 추정)
  4. 과거 납부 세금
- 하단: 기존 시뮬레이터 (부가세 + 종소세)
- ⬜ 다음 신고일 D-day 카드 추가?

### `/members` 회원
- 회원 목록 + 검색 + 필터 (활성/휴면/만료임박)
- 각 회원 행: 이름 / 전화 / 수강권 잔여 / 마지막 출석
- 액션: 회원 추가 / 메시지 발송 / 토큰 URL 복사

### `/lessons` 수업
- 월 캘린더 + 일별 수업 리스트
- 반복 등록 (개인 / 그룹)
- 차감 룰 안내

### `/assistant` AI 비서 (풀스크린, optional)
- 우하단 widget이 메인. 풀스크린은 긴 대화 가독성용

---

## 4. 권한 모델

### 현재 (단순 binary)

| 역할 | 접근 |
|---|---|
| 비인증 | `/login`, `/signup`, `/m/[token]/*`, `/api/health`, `/api/auth/*`, `/api/m/*` |
| 인증 (owner) | 본인 owner_id 데이터 전부 |
| 회원 (token 보유) | `/m/[token]/*`만, 자기 데이터만 |

### ⬜ 미래 확장 (결정 필요)
- 강사 권한: 자기 수업/회원만 보이게? 별도 로그인?
- 관리자 권한: 사용자 본인 + 부 운영자 (예: 매니저)
- 외부 세무사 권한: 읽기 전용?

---

## 5. URL 규칙

- **RESTful**: `/api/{resource}` (GET 목록 / POST 신규)
- **개별**: `/api/{resource}/[id]` (GET 상세 / PATCH 수정 / DELETE 삭제)
- **하위**: `/api/{resource}/[id]/{action}` (예: `/api/passes/[id]/bonus`)
- **bulk**: `/api/{resource}/bulk` (다중 insert)
- **회원 페이지 API**: `/api/m/[token]/...` (인증 우회)

---

## 6. 데이터 모델 (개념적 ER)

```
auth.users (Supabase Auth)
  └─ profile (1:1, owner_id)
        ├─ workspace_name, role, business_phone, business_address
        ├─ birth_date, isYoungStartupEligible, ...
        └─ tax_payer_type (general | simplified)

owner_id (auth.users.id)
  ├─ transactions     # 거래
  ├─ members          # 회원
  │     └─ passes     # 수강권 (member 1:N)
  │           ├─ pass_adjustments (1:N, 회차 보너스 이력)
  │           └─ lessons (1:N, 회차 차감 source)
  ├─ instructors      # 강사
  │     ├─ payroll_records (월별 급여)
  │     └─ lessons (담당)
  ├─ pass_products    # 수강권 카탈로그
  ├─ group_sessions   # 그룹 수업
  │     └─ group_reservations (예약, 회원 N:N session)
  ├─ expense_categories  # 비용 카테고리
  ├─ message_records  # 메시지 발송 기록
  └─ chat_sessions    # AI 비서 대화
        └─ chat_messages (1:N)
```

---

## 7. 사용자 흐름 → 페이지 매핑

→ 자세한 user flow는 `docs/USER-FLOWS.md` 참조.

| 사용자 의도 | 시작 페이지 | 거치는 페이지 |
|---|---|---|
| "오늘 수업 보자" | `/` 또는 `/lessons` | — |
| "회원 결제 받았어" | `/add` | (자동) passes 발급 |
| "강사 급여 얼마지" | `/payroll` 또는 `/instructors` | `/payroll/auto` |
| "이번 달 매출 어때" | `/finances` | (차트 / KPI) |
| "다음 부가세 얼마야" | `/tax` | (시뮬레이터) |
| "박지영 회원 어때" | `/members` → 검색 | `/members/[id]` |
| "광고비 어디 제일 많이 썼어" | AI 비서 위젯 | (tool 호출) |
| "강사 1명 추가" | `/instructors` | (인라인 폼) |

---

## 8. 정보 hierarchy 룰

- **3단계 이하** — admin pages는 nav 1단계 + 페이지 내 탭 1단계 + 상세 1단계까지
- **breadcrumb 없음** — 단순한 구조라 불필요. URL과 nav가 위치 알려줌
- **검색은 페이지 내** — 글로벌 검색 X (정보량 적음)
- **모달 최소화** — 새 페이지나 인라인 폼이 우선

---

## ⬜ 빈칸 (사용자가 채워야 할 IA 결정)

1. **홈(`/`) 대시보드 위젯 우선순위**
   - 오늘 수업 / 이번달 매출 / 만료임박 회원 / 다음 세금 D-day / AI 추천 / 시즌성 그래프 — 어떤 게 먼저?

2. **확장 ICP의 정보 구조**
   - PT 사장님은 회원 단위가 아니라 *세션 단위*가 더 자연스러울 수도. 페이지 구조 그대로?

3. **강사 권한 분리 시 IA**
   - 강사 본인 로그인하면 어떤 페이지 보이게? `/lessons/me`? `/payroll/me`?

4. **회원에게 직접 결제 받기**
   - 현재는 사장님이 매출 입력. 회원이 카드로 결제하면 자동 입력되는 흐름 추가?
   - 추가하면 어디 페이지에 결제 버튼 노출?

5. **다국어 지원 여부**
   - 한국어만? 영어 추가?
