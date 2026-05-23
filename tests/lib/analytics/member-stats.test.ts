import { describe, it, expect } from 'vitest'
import { computeMemberLTV, computeAttendanceStats } from '@/lib/analytics/member-stats'
import type { Pass } from '@/lib/supabase/passes'
import type { Lesson } from '@/lib/supabase/lessons'

function pass(amount: number, paidAt: string): Pass {
  return {
    id: 0, memberId: 1, instructorId: null, passName: '개인', passType: '프라이빗',
    startDate: null, endDate: null,
    totalCount: null, remainingCount: null, availableCount: null, cancellableCount: null,
    status: '이용중', paymentType: '신규결제', paymentAmount: amount,
    paidAt, paymentMethod: '카드', installment: null, isFamily: false,
    issuedAt: null, lastModifiedAt: null,
  }
}

function lesson(date: string, status: Lesson['status'] = 'completed'): Lesson {
  return {
    id: 0, passId: null, memberId: 1, instructorId: null,
    lessonDate: date, lessonTime: null, durationMinutes: 50,
    status, deducted: status === 'completed', memo: null,
  }
}

describe('computeMemberLTV', () => {
  it('총 결제액·평균·첫/마지막', () => {
    const passes = [
      pass(650000, '2025-06-01'),
      pass(1300000, '2025-12-01'),
      pass(770000, '2026-03-01'),
    ]
    const ltv = computeMemberLTV(passes)
    expect(ltv.totalPaid).toBe(650000 + 1300000 + 770000)
    expect(ltv.passCount).toBe(3)
    expect(ltv.averagePaymentAmount).toBe(906667)
    expect(ltv.firstPaidAt).toBe('2025-06-01')
    expect(ltv.lastPaidAt).toBe('2026-03-01')
  })
  it('빈 입력', () => {
    const ltv = computeMemberLTV([])
    expect(ltv.totalPaid).toBe(0)
    expect(ltv.firstPaidAt).toBe(null)
  })
})

describe('computeAttendanceStats', () => {
  it('30/60/90일 출석 수 + 평균 간격', () => {
    const today = '2026-05-23'
    const lessons = [
      lesson('2026-05-20'),  // last30
      lesson('2026-05-13'),  // last30
      lesson('2026-04-01'),  // last60
      lesson('2026-03-01'),  // last90
      lesson('2026-01-01'),  // 이전
    ]
    const s = computeAttendanceStats(lessons, today)
    expect(s.last30).toBe(2)
    expect(s.last60).toBe(3)
    expect(s.last90).toBe(4)
    expect(s.totalCompleted).toBe(5)
    expect(s.averageDaysBetween).not.toBeNull()
  })
})
