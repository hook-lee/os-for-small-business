import type { LessonStatus } from '@/lib/supabase/lessons'

const DEDUCTED_STATUSES: LessonStatus[] = ['completed', 'cancelled_same_day', 'noshow']

export function statusDeducts(s: LessonStatus): boolean {
  return DEDUCTED_STATUSES.includes(s)
}

/**
 * 상태 변경 시 회차에 적용할 delta 반환.
 * -1: 새로 차감
 * +1: 차감 되돌림
 *  0: 변화 없음
 */
export function computeDeductionDelta(
  currentDeducted: boolean,
  newStatus: LessonStatus,
): number {
  const targetDeducts = statusDeducts(newStatus)
  if (!currentDeducted && targetDeducts) return -1
  if (currentDeducted && !targetDeducts) return +1
  return 0
}
