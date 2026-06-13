export type PayrollCategory = 'private' | 'rehab' | 'duet' | 'group'

/**
 * 급여 자동 집계에 '카운트되는' 개별 수업 상태.
 *  - scheduled          : 예약됨 (아직 완료 표시 안 함) — 그룹 세션과 대칭 맞추려 포함
 *  - completed          : 진행 완료
 *  - cancelled_same_day : 당일 취소 (회차 차감됨 = 강사 시간 사용)
 *  - noshow             : 노쇼 (회차 차감됨)
 * 제외: cancelled_advance(사전 취소, 미차감) + 삭제된 수업(쿼리에 안 잡힘).
 *
 * (기존 버그: 'scheduled' 누락 → 개별 수업이 완료 표시 전엔 급여에 0으로 잡혔다.
 *  그룹 세션은 status 개념 없이 active만 보므로 예약만 해도 잡혀 비대칭 발생.)
 */
export const PAYROLL_COUNTED_STATUSES = ['scheduled', 'completed', 'cancelled_same_day', 'noshow'] as const

/**
 * 급여 자동집계에 카운트할 수업 상태를 센터 설정으로 동적 생성.
 *  - 항상 포함: scheduled(예약), completed(완료)
 *  - 설정에 따라 포함: cancelled_same_day(당일취소), noshow(노쇼)
 * 센터마다 "당일취소·노쇼를 강사 급여에 줄지" 정책이 달라 커스텀 가능하게 한다.
 */
export function payrollCountedStatuses(opts: { sameDayCancel: boolean; noshow: boolean }): string[] {
  const list = ['scheduled', 'completed']
  if (opts.sameDayCancel) list.push('cancelled_same_day')
  if (opts.noshow) list.push('noshow')
  return list
}

export type PayrollAggregateMode = 'full' | 'todate'

export interface PayrollWindow {
  start: string  // 'YYYY-MM-DD'
  end: string    // 'YYYY-MM-DD' — 포함
}

/**
 * 집계 날짜 창.
 *  - full   : 그 달 1일 ~ 말일 (예약 포함 전체)
 *  - todate : 그 달 1일 ~ min(today, 말일) (현 시점까지 진행분)
 * today가 그 달 이전이면 end < start (빈 창) → 호출부 쿼리는 0건.
 */
export function resolvePayrollWindow(yearMonth: string, mode: PayrollAggregateMode, today: string): PayrollWindow {
  const [y, m] = yearMonth.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const start = `${yearMonth}-01`
  const monthEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
  if (mode === 'full') return { start, end: monthEnd }
  const end = today < monthEnd ? today : monthEnd
  return { start, end }
}

export function passNameToPayrollCategory(passName: string | null | undefined): PayrollCategory {
  if (!passName) return 'private'
  if (passName.includes('재활')) return 'rehab'
  if (passName.includes('듀엣')) return 'duet'
  if (passName.includes('그룹') || passName.includes('소그룹')) return 'group'
  return 'private'
}

/**
 * 예약형 수업(group_sessions)의 '수업 종류' → 급여 카테고리.
 * group_sessions는 개인(정원1)·듀엣(정원2)·그룹(정원N)을 모두 담는 통합 모델이므로,
 * 종류를 보고 정확한 급여 버킷에 넣어야 한다. (기본 = group)
 */
export function sessionCategoryToPayrollCategory(category: string | null | undefined): PayrollCategory {
  if (!category) return 'group'
  if (category.includes('재활')) return 'rehab'
  if (category.includes('듀엣')) return 'duet'
  if (category.includes('개인') || category.includes('1:1')) return 'private'
  return 'group'   // 그룹/소그룹/기타
}

/** 4종 영문 버킷 → 레거시 한국어 카테고리명 (effectiveRateMap의 레거시 키와 정렬). */
const LEGACY_CATEGORY_LABEL: Record<PayrollCategory, string> = {
  private: '개인', rehab: '재활', duet: '듀엣', group: '그룹',
}

/**
 * 개별 수업의 급여 카테고리 = 수강권 상품의 상위 카테고리(원장 설정, pass_products.category). (§0)
 * passes에 상품 FK가 없어 수강권 이름(스냅샷)으로 상품을 찾는다.
 * 상품 매칭 실패/카테고리 미설정이면 이름 키워드 폴백(레거시 동작 보존).
 */
export function resolveIndividualCategory(
  passName: string | null | undefined,
  productCategoryByName: Map<string, string | null | undefined>,
): string {
  const name = (passName ?? '').trim()
  if (name) {
    const cat = productCategoryByName.get(name)
    if (cat) return cat
  }
  return LEGACY_CATEGORY_LABEL[passNameToPayrollCategory(passName)]
}

interface PayrollBucket { privateCount: number; rehabCount: number; duetCount: number; groupCount: number }

function addToBucket(counts: PayrollBucket, cat: PayrollCategory): void {
  if (cat === 'private') counts.privateCount++
  else if (cat === 'rehab') counts.rehabCount++
  else if (cat === 'duet') counts.duetCount++
  else counts.groupCount++
}

/**
 * 개별 수업(passName) + 예약형 수업(category)을 각각 급여 카테고리로 분류해 합산.
 * (기존엔 group_sessions를 무조건 group으로 셌으나, 정원1=개인 등을 위해 종류별로 버킷팅.)
 */
export function bucketLessonCounts(
  individualPassNames: Array<string | null>,
  groupSessionCategories: Array<string | null>,
): PayrollBucket {
  const counts: PayrollBucket = { privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0 }
  for (const name of individualPassNames) addToBucket(counts, passNameToPayrollCategory(name))
  for (const cat of groupSessionCategories) addToBucket(counts, sessionCategoryToPayrollCategory(cat))
  return counts
}
