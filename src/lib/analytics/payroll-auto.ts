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

export function bucketLessonCounts(
  individualPassNames: Array<string | null>,
  groupSessionCount: number,
): { privateCount: number; rehabCount: number; duetCount: number; groupCount: number } {
  const counts = { privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0 }
  for (const name of individualPassNames) {
    const cat = passNameToPayrollCategory(name)
    if (cat === 'private') counts.privateCount++
    else if (cat === 'rehab') counts.rehabCount++
    else if (cat === 'duet') counts.duetCount++
    else if (cat === 'group') counts.groupCount++
  }
  counts.groupCount += groupSessionCount
  return counts
}
