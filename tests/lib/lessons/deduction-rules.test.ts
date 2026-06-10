import { describe, it, expect } from 'vitest'
import { statusDeducts, computeDeductionDelta, classifyLessonCancel } from '@/lib/lessons/deduction-rules'

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

describe('classifyLessonCancel (시간 기준 자동 취소)', () => {
  // now = UTC 2026-06-18T00:00:00Z = KST 09:00. cutoff 6시간.
  const NOW = '2026-06-18T00:00:00Z'

  it('정책 OFF → 항상 당일취소(차감)', () => {
    expect(classifyLessonCancel('2026-06-18', '18:00', NOW, 6, 0, false)).toBe('cancelled_same_day')
  })
  it('마감(6h)보다 일찍 취소 → 사전취소(미차감)', () => {
    // KST 18:00 수업 = now(KST 09:00)로부터 9시간 전 ≥ 6h
    expect(classifyLessonCancel('2026-06-18', '18:00', NOW, 6, 0, true)).toBe('cancelled_advance')
  })
  it('마감(6h) 이내 취소 → 당일취소(차감)', () => {
    // KST 14:00 수업 = 5시간 전 < 6h
    expect(classifyLessonCancel('2026-06-18', '14:00', NOW, 6, 0, true)).toBe('cancelled_same_day')
  })
  it('이미 지난 수업 취소 → 당일취소(차감)', () => {
    expect(classifyLessonCancel('2026-06-17', '10:00', NOW, 6, 0, true)).toBe('cancelled_same_day')
  })
})
