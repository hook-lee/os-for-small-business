# 강사 성과 비교 (Instructor Scorecard) — 설계

- 작성일: 2026-06-03
- 상태: 승인됨 (A안 + Light)
- 맥락: Onmove SaaS. 원장이 강사들의 성과를 한 화면에서 비교 → 인센티브 설계 판단. 라파 전용이 아니라 모든 스튜디오 공통 기능.

## 문제

- 강사별 재등록률·전환율은 이미 강사 **상세 페이지**(`/instructors/[id]`)에 4박스로 존재.
- 그러나 강사를 **나란히 비교**할 화면이 없음 → 한 명씩 클릭해야 함.
- 인센티브 기반 강사 채용·유지가 업계 표준이 되며, "누가 잘하고 못하나"를 한눈에 보는 비교 뷰가 제품 차별점.

## 결정 (승인된 선택지)

1. **위치/주체**: 원장용 전용 "강사 성과" 탭 (`/instructors?tab=scorecard`). 강사 본인 로그인은 범위 외(추후).
2. **기간**: 선택 가능 — `month`/`quarter`/`year`/`all`. 서버 재계산 (`?period=` 쿼리, 기존 `?ym=` 패턴과 동일).
3. **인센티브**: Light — `member_instructor_rates` 기반 "회당 금액 · 대상 회원 수 · 미설정 여부"만. 실지급액 계산(급여 조인)은 범위 외.

## 핵심 설계 판단: 지표별 "기간" 의미 (A안)

기간 선택은 지표마다 의미가 다르다. 정직하게 분리한다.

| 지표 | 기간 적용 | 정의 |
|---|---|---|
| 매출 (강사 귀속) | ✅ 기간 | 그 강사 담당 passes 중 `paidAt`이 기간 내인 것의 `paymentAmount` 합 |
| 신규 회원 | ✅ 기간 | 그 강사와의 **첫 결제**(paidAt)가 기간 내인 회원 수 |
| 재등록 건수 | ✅ 기간 | 기간 내 passes 중 그 회원의 "그 강사와 첫 pass가 아닌" 건수 (= 재결제 발생) |
| 전환율 | ⚠️ 누적 | 체험→정회원은 시차가 커서 단기 기간은 0%로 오해 유발 → 항상 누적, `(누적)` 태그 |
| 재등록률 | ⚠️ 누적 | 코호트 누적 개념 → 누적, `(누적)` 태그 |
| 활성 회원 | ⚠️ 현재 | "현재 이용중" 스냅샷 → 기간 무관, `(현재)` 태그 |

원칙: **기간이 바꾸는 건 흐름(합계/건수)뿐**. 비율·스냅샷은 누적/현재로 고정하고 라벨로 명시.

### 매출 귀속 주의
AGENTS.md 금지룰 #1(passes.payment_amount를 **스튜디오 매출 통계**에 합산 금지)은 유지된다. 여기 "매출"은 스튜디오 매출이 아니라 **강사 귀속 결제액**(attribution)이며, 기존 강사 목록의 `revenueByInstructor`·상세 KPI와 동일한 기준. UI 라벨에 "강사 귀속" 명시.

## 아키텍처 (마이그레이션 0개)

기존 데이터만 사용: `passes.paidAt`(존재), `member_instructor_rates`(v3.9 적용). 새 DB 없음.

### 신규 pure 함수
- `src/lib/analytics/period.ts`
  - `resolvePeriod(key: 'month'|'quarter'|'year'|'all', today: string): { start: string; end: string } | null`
  - `all` → null(필터 없음). 그 외 → `[기간 시작일, today]`. ISO `YYYY-MM-DD`.
- `src/lib/analytics/instructor-scorecard.ts`
  - `computeInstructorScorecards(instructors, allPasses, allByMember, period, ratesByInstructor)` → `InstructorScorecardRow[]`
  - 기간 흐름 지표 + 누적 비율(기존 `computeInstructorKPI` 로직 재사용/공유) + 스냅샷 활성 + Light 인센티브.
  - 기존 `computeInstructorKPI`는 **변경 없음**(상세 페이지 누적 유지).

### Row 형태(개념)
```
instructorId, instructorName, role,
revenue(기간), newMembers(기간), reregistrationCount(기간),
trialConversionRate(누적)+trialDetail, reregistrationRate(누적),
activeMembers(현재),
incentive: { memberCount, perSessionMin, perSessionMax, hasAny }
```

### 페이지/컴포넌트
- `src/app/instructors/page.tsx` (편집): `tab==='scorecard'`일 때 passes + member_instructor_rates fetch → `computeInstructorScorecards` → 컴포넌트 전달. `period` 쿼리 파싱.
- `src/app/instructors/InstructorsTabs.tsx` (편집): 3번째 탭 '강사 성과' 추가.
- `src/app/instructors/InstructorScorecard.tsx` (신규, client): 기간 버튼(router.push), 컬럼 클릭 정렬, 상·하위 색 강조(매출/전환율 기준 등). 금액 `toLocaleString()+원`.

## 테스트
- `tests/lib/analytics/period.test.ts`: month/quarter/year 경계, all→null.
- `tests/lib/analytics/instructor-scorecard.test.ts`: 기간 매출 합, 신규(첫 결제 기간), 재등록 건수, 누적 비율 일치, 활성 스냅샷, 인센티브 집계, 빈 입력.

## 검증 게이트
`npx tsc --noEmit && npx vitest run && npx next build` 모두 통과.

## 범위 외 (추후)
- 강사 본인 로그인 열람(강사 auth)
- Full 인센티브(기간 실지급액 = 수업 조인)
- 전환율/재등록률의 기간 코호트(B안)
