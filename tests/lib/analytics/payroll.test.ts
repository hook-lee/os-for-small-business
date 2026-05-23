import { describe, it, expect } from 'vitest'
import { computePayrollTotal } from '@/lib/analytics/payroll'
import type { Instructor } from '@/lib/supabase/instructors'

const instructor: Instructor = {
  id: 1, name: '김유진', phone: null, role: 'owner',
  employmentType: null, defaultHourlyRate: 30000,
  ratePrivate: 30000, rateRehab: 35000, rateDuet: 40000, rateGroup: 20000,
  color: null, active: true,
}

describe('computePayrollTotal', () => {
  it('각 종류별 횟수 × 시급 합산', () => {
    const r = computePayrollTotal(instructor, {
      privateCount: 10, rehabCount: 5, duetCount: 3, groupCount: 8,
    })
    expect(r.privateTotal).toBe(300_000)
    expect(r.rehabTotal).toBe(175_000)
    expect(r.duetTotal).toBe(120_000)
    expect(r.groupTotal).toBe(160_000)
    expect(r.grossTotal).toBe(755_000)
  })

  it('0 횟수면 0', () => {
    const r = computePayrollTotal(instructor, { privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0 })
    expect(r.grossTotal).toBe(0)
  })

  it('시급 균등(30k)이면 총 = (총횟수) × 30k', () => {
    const equalInst = { ...instructor, rateRehab: 30000, rateDuet: 30000, rateGroup: 30000 }
    const r = computePayrollTotal(equalInst, { privateCount: 2, rehabCount: 3, duetCount: 1, groupCount: 4 })
    expect(r.grossTotal).toBe(10 * 30000)
  })
})
