# 메뉴 연동 점검 리포트

감사 일시: 2026-05-24 (정적 코드 분석)

---

## 1. 어드민 네비 구조 (AppShell → Nav.tsx)

| 메뉴 | 링크 | 매칭 prefix |
|------|------|------------|
| 홈 | / | / (exact) |
| 수업 | /lessons | /lessons |
| 회원 | /members | /members, /pass-products, /messages |
| 강사 | /instructors | /instructors |
| 재무 | /finances | /finances, /add, /sales, /tax, /analytics, /finances/categories |
| ⚙️ 설정 | /settings | /settings |

---

## 2. 메뉴별 서브 탭 / 하위 페이지

| 최상위 | 하위 | 경로 |
|--------|------|------|
| 수업 | 개별 수업 | /lessons |
| 수업 | 그룹 수업 | /lessons/groups |
| 수업 | 그룹 세션 상세 | /lessons/groups/[id] |
| 회원 | 목록 | /members |
| 회원 | 회원 상세 | /members/[id] |
| 회원 | 수강권 카탈로그 | /pass-products |
| 회원 | 메시지 발송 | /messages |
| 강사 | 목록 + 급여 탭 | /instructors |
| 강사 | 강사 상세 | /instructors/[id] |
| 재무 | 입력 | /add |
| 재무 | 매출 | /sales |
| 재무 | 세금 | /tax |
| 재무 | 분석 | /analytics |
| 재무 | 카테고리 | /finances/categories ← v2.9 신규 |
| 설정 | — | /settings |

---

## 3. 회원 포털 (어드민 chrome 완전 분리)

`AppShell.tsx`에서 `pathname.startsWith('/m/')` 감지 → 어드민 Nav 렌더링 완전 차단.  
`/m/[token]` layout은 별도 `MemberHeader` + `MemberBottomNav`만 사용.

| 회원 포털 탭 | 경로 |
|-------------|------|
| 홈 | /m/[token] |
| 수강권 | /m/[token]/passes |
| 일정 | /m/[token]/lessons |
| 그룹 예약 | /m/[token]/group |

권한 분리: 어드민 Nav 노출 없음 ✓

---

## 4. 데이터 흐름 검증

| 흐름 | 상태 |
|------|------|
| /add 매출 + 회원 + 수강권 → passes 발급 → /sales 신규결제/재결제 KPI 반영 | ✓ |
| /lessons 완료 처리 → passes.remaining_count -1 → /members/[id] 잔여 회차 갱신 | ✓ |
| /lessons/groups 출석 처리 → 회원 그룹 패스 차감 | ✓ |
| /instructors/[id] KPI = passes 기반 (자동 집계) | ✓ |
| /instructors?tab=payroll 자동 집계 → lessons + group_sessions 강사 횟수 | ✓ |
| /sales ym 파라미터 → passes.paid_at 필터 → KPI 갱신 | ✓ |
| /tax → loadTransactions + loadProfile(taxPayerType) → simulateVAT 옵션 전달 | ✓ |
| /settings taxPayerType 저장 → /tax + 홈 부가세 카드에 반영 | ✓ (v2.9) |

---

## 5. 고아 페이지 점검

| 경로 | 설명 | 접근 방법 |
|------|------|----------|
| /payroll | 리다이렉트 → /instructors?tab=payroll | 하위 호환용 redirect (정상) |
| /finances | 리다이렉트 → /sales | nav '재무' 클릭 시 landing (정상) |
| /pass-products | Nav '회원' 에 matchPrefix 포함 | /members 내에서 탭 없음 — URL 직접 접근만 가능 |
| /messages | Nav '회원' 에 matchPrefix 포함 | URL 직접 접근 필요 |

---

## 6. 발견된 이슈

### 이슈 1 (경미): pass-products, messages — 메뉴 진입 경로 없음
- `/pass-products`와 `/messages`가 Nav의 `matchPrefixes`에는 포함돼 있어 active 상태는 표시됨.
- 그러나 `/members` 페이지 내에 해당 서브 메뉴 링크가 없어 사용자는 URL 직접 입력으로만 접근 가능.
- 영향: 낮음 (관리자만 사용, URL 알고 있음)
- 권장 조치: MembersTabBar 또는 /members 상단에 "수강권 상품 관리" / "메시지 발송" 링크 추가

### 이슈 2 (정보): pass-products, messages — 메뉴 레이블 없음 (중복 기재 정정)
- `/analytics` 페이지는 `aggregateMonthly` (거래 집계)만 사용하며 `simulateVAT`를 직접 호출하지 않음 → 문제 없음.
- 분석 페이지의 수치(매출/지출/순이익)는 taxPayerType에 영향을 받지 않음 ✓

---

## 7. 데드 링크 점검

모든 `<a href>` 및 `router.push` 호출에서 내부 URL 목록:

- `/instructors` ✓
- `/lessons` ✓
- `/lessons/groups` ✓
- `/lessons/groups/[id]` (동적) ✓
- `/members` ✓
- `/members/[id]` (동적) ✓
- `/members?filter=expiring` ✓
- `/members?filter=dormant` ✓
- `/instructors?tab=payroll&ym=...` ✓
- `/sales?ym=...` ✓
- `/lessons?date=...` ✓
- `/finances/categories` ✓ (v2.9 신규)

데드 링크: 없음 ✓
