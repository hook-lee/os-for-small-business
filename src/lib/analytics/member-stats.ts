import type { Pass } from '@/lib/supabase/passes'
import type { Lesson } from '@/lib/supabase/lessons'

export interface MemberLTV {
  totalPaid: number          // 모든 passes payment_amount 합
  passCount: number
  averagePaymentAmount: number
  firstPaidAt: string | null
  lastPaidAt: string | null
}

export function computeMemberLTV(passes: Pass[]): MemberLTV {
  const valid = passes.filter(p => (p.paymentAmount ?? 0) > 0)
  const totalPaid = valid.reduce((s, p) => s + (p.paymentAmount ?? 0), 0)
  const paidDates = valid.map(p => p.paidAt).filter((d): d is string => !!d).sort()
  return {
    totalPaid,
    passCount: valid.length,
    averagePaymentAmount: valid.length === 0 ? 0 : Math.round(totalPaid / valid.length),
    firstPaidAt: paidDates[0] ?? null,
    lastPaidAt: paidDates[paidDates.length - 1] ?? null,
  }
}

export interface AttendanceStats {
  last30: number
  last60: number
  last90: number
  totalCompleted: number
  averageDaysBetween: number | null  // null if < 2 sessions
}

/**
 * 회원의 수업 출석 통계 (status='completed'만 카운트)
 */
export function computeAttendanceStats(lessons: Lesson[], today: string): AttendanceStats {
  const todayDate = new Date(today)
  const completed = lessons.filter(l => l.status === 'completed').sort((a, b) => a.lessonDate.localeCompare(b.lessonDate))

  const cutoff30 = new Date(todayDate); cutoff30.setDate(cutoff30.getDate() - 30)
  const cutoff60 = new Date(todayDate); cutoff60.setDate(cutoff60.getDate() - 60)
  const cutoff90 = new Date(todayDate); cutoff90.setDate(cutoff90.getDate() - 90)
  const c30s = cutoff30.toISOString().slice(0, 10)
  const c60s = cutoff60.toISOString().slice(0, 10)
  const c90s = cutoff90.toISOString().slice(0, 10)

  const last30 = completed.filter(l => l.lessonDate >= c30s).length
  const last60 = completed.filter(l => l.lessonDate >= c60s).length
  const last90 = completed.filter(l => l.lessonDate >= c90s).length

  let averageDaysBetween: number | null = null
  if (completed.length >= 2) {
    const gaps: number[] = []
    for (let i = 1; i < completed.length; i++) {
      const a = new Date(completed[i - 1].lessonDate)
      const b = new Date(completed[i].lessonDate)
      gaps.push(Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)))
    }
    averageDaysBetween = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length)
  }

  return { last30, last60, last90, totalCompleted: completed.length, averageDaysBetween }
}
