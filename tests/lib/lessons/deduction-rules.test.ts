import { describe, it, expect } from 'vitest'
import { statusDeducts, computeDeductionDelta } from '@/lib/lessons/deduction-rules'

describe('statusDeducts', () => {
  it('완료 / 당일 취소 / 노쇼 → 차감', () => {
    expect(statusDeducts('completed')).toBe(true)
    expect(statusDeducts('cancelled_same_day')).toBe(true)
    expect(statusDeducts('noshow')).toBe(true)
  })
  it('예약 / 사전 취소 → 미차감', () => {
    expect(statusDeducts('scheduled')).toBe(false)
    expect(statusDeducts('cancelled_advance')).toBe(false)
  })
})

describe('computeDeductionDelta', () => {
  it('예약(미차감) → 완료: -1', () => {
    expect(computeDeductionDelta(false, 'completed')).toBe(-1)
  })
  it('완료(차감) → 사전취소: +1 (되돌림)', () => {
    expect(computeDeductionDelta(true, 'cancelled_advance')).toBe(+1)
  })
  it('완료(차감) → 노쇼(여전히 차감): 0', () => {
    expect(computeDeductionDelta(true, 'noshow')).toBe(0)
  })
  it('예약(미차감) → 사전취소(미차감): 0', () => {
    expect(computeDeductionDelta(false, 'cancelled_advance')).toBe(0)
  })
})
