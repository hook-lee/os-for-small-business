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

/**
 * 수업 '취소'를 운영설정(마감시간 기준)으로 자동 분류한다.
 *  - policyEnabled=false → 취소는 항상 '당일취소'(차감). (마감 없는 센터)
 *  - policyEnabled=true  → 수업까지 cutoff(시간+분) 이상 남았으면 '사전취소'(미차감),
 *                          그보다 늦으면(혹은 이미 지남) '당일취소'(차감).
 * 스튜디오 시간대는 KST(UTC+9) 가정 — 한국 센터 전용. nowISO는 UTC(toISOString).
 */
export function classifyLessonCancel(
  lessonDate: string,            // 'YYYY-MM-DD'
  lessonTime: string | null,     // 'HH:MM' (null이면 00:00 취급)
  nowISO: string,                // 현재 시각 ISO(UTC)
  cutoffHours: number,
  cutoffMinutes: number,
  policyEnabled: boolean,
): LessonStatus {
  if (!policyEnabled) return 'cancelled_same_day'
  const lessonMs = new Date(`${lessonDate}T${lessonTime || '00:00'}:00+09:00`).getTime()
  const nowMs = new Date(nowISO).getTime()
  if (!Number.isFinite(lessonMs) || !Number.isFinite(nowMs)) return 'cancelled_same_day'
  const minutesUntil = (lessonMs - nowMs) / 60_000
  const cutoff = cutoffHours * 60 + cutoffMinutes
  return minutesUntil >= cutoff ? 'cancelled_advance' : 'cancelled_same_day'
}
