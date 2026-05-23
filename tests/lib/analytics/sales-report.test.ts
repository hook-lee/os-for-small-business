import { describe, it, expect } from 'vitest'
import {
  computePassesKPI, revenueByProduct, revenueByInstructor, revenueByMethod, revenueByMonth, filterPassesByRange,
} from '@/lib/analytics/sales-report'
import type { Pass } from '@/lib/supabase/passes'

function p(opts: Partial<Pass> & { passName: string; paymentAmount: number }): Pass {
  return {
    id: 0, memberId: 1, instructorId: opts.instructorId ?? null,
    passName: opts.passName, passType: opts.passType ?? '프라이빗',
    startDate: null, endDate: null,
    totalCount: null, remainingCount: null, availableCount: null, cancellableCount: null,
    status: opts.status ?? '이용중',
    paymentType: opts.paymentType ?? '신규결제',
    paymentAmount: opts.paymentAmount,
    paidAt: opts.paidAt ?? '2026-05-01',
    paymentMethod: opts.paymentMethod ?? '카드',
    installment: null, isFamily: false,
    issuedAt: null, lastModifiedAt: null,
  }
}

describe('computePassesKPI', () => {
  it('총합·신규결제·재결제·체험·환불 분류', () => {
    const passes = [
      p({ passName: '개인', paymentAmount: 650000, paymentType: '신규결제' }),
      p({ passName: '재활', paymentAmount: 770000, paymentType: '재결제' }),
      p({ passName: '체험', paymentAmount: 30000, paymentType: '신규결제' }),
      p({ passName: '듀엣', paymentAmount: -50000, paymentType: '신규결제' }),  // 환불
    ]
    const r = computePassesKPI(passes)
    expect(r.total).toBe(650000 + 770000 + 30000)
    expect(r.newPayment).toBe(650000 + 30000)
    expect(r.rePayment).toBe(770000)
    expect(r.trialPayment).toBe(30000)
    expect(r.refund).toBe(50000)
    expect(r.transactionCount).toBe(4)
  })
})

describe('revenueByProduct', () => {
  it('상품명별 그룹화 + 합계', () => {
    const passes = [
      p({ passName: '개인', paymentAmount: 650000 }),
      p({ passName: '개인', paymentAmount: 1300000 }),
      p({ passName: '체험', paymentAmount: 30000 }),
    ]
    const r = revenueByProduct(passes)
    expect(r.find(x => x.name === '개인')?.total).toBe(1950000)
    expect(r.find(x => x.name === '개인')?.count).toBe(2)
    expect(r.find(x => x.name === '체험')?.total).toBe(30000)
  })
})

describe('revenueByInstructor', () => {
  it('강사 ID로 그룹화, instructor_id null은 제외', () => {
    const passes = [
      p({ passName: '개인', paymentAmount: 650000, instructorId: 1 }),
      p({ passName: '개인', paymentAmount: 650000, instructorId: 1 }),
      p({ passName: '재활', paymentAmount: 770000, instructorId: 2 }),
      p({ passName: '체험', paymentAmount: 30000, instructorId: null }),
    ]
    const map = new Map([[1, '김유진'], [2, '김우영']])
    const r = revenueByInstructor(passes, map)
    expect(r.find(x => x.instructorId === 1)?.total).toBe(1300000)
    expect(r.find(x => x.instructorId === 2)?.total).toBe(770000)
    expect(r.length).toBe(2)
  })
})

describe('revenueByMethod', () => {
  it('결제 수단별 그룹화', () => {
    const passes = [
      p({ passName: '개인', paymentAmount: 650000, paymentMethod: '카드' }),
      p({ passName: '재활', paymentAmount: 770000, paymentMethod: '카드' }),
      p({ passName: '듀엣', paymentAmount: 1540000, paymentMethod: '계좌이체' }),
    ]
    const r = revenueByMethod(passes)
    expect(r.find(x => x.method === '카드')?.total).toBe(650000 + 770000)
    expect(r.find(x => x.method === '계좌이체')?.total).toBe(1540000)
  })
})

describe('revenueByMonth', () => {
  it('paid_at 기준 월별 그룹화', () => {
    const passes = [
      p({ passName: '개인', paymentAmount: 650000, paidAt: '2026-05-01' }),
      p({ passName: '재활', paymentAmount: 770000, paidAt: '2026-05-15' }),
      p({ passName: '개인', paymentAmount: 1300000, paidAt: '2026-06-01' }),
    ]
    const r = revenueByMonth(passes)
    expect(r.find(x => x.month === '2026-05')?.total).toBe(1420000)
    expect(r.find(x => x.month === '2026-06')?.total).toBe(1300000)
  })
})

describe('filterPassesByRange', () => {
  it('paid_at 범위로 필터', () => {
    const passes = [
      p({ passName: '개인', paymentAmount: 650000, paidAt: '2026-04-15' }),
      p({ passName: '재활', paymentAmount: 770000, paidAt: '2026-05-15' }),
      p({ passName: '듀엣', paymentAmount: 1540000, paidAt: '2026-06-15' }),
    ]
    const r = filterPassesByRange(passes, '2026-05-01', '2026-05-31')
    expect(r.length).toBe(1)
    expect(r[0].passName).toBe('재활')
  })
})
