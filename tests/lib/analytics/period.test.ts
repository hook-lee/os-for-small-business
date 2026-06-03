import { describe, it, expect } from 'vitest'
import { resolvePeriod, isInPeriod, isPeriodKey } from '@/lib/analytics/period'

describe('resolvePeriod', () => {
  it("'all'은 null (필터 없음)", () => {
    expect(resolvePeriod('all', '2026-06-03')).toBeNull()
  })

  it("'month'은 이달 1일 ~ today", () => {
    expect(resolvePeriod('month', '2026-06-03')).toEqual({ start: '2026-06-01', end: '2026-06-03' })
  })

  it("'year'은 1월 1일 ~ today", () => {
    expect(resolvePeriod('year', '2026-06-03')).toEqual({ start: '2026-01-01', end: '2026-06-03' })
  })

  it("'quarter' Q2(6월) → 4월 1일 시작", () => {
    expect(resolvePeriod('quarter', '2026-06-03')).toEqual({ start: '2026-04-01', end: '2026-06-03' })
  })

  it("'quarter' Q1(1월) → 1월 1일 시작", () => {
    expect(resolvePeriod('quarter', '2026-01-15')?.start).toBe('2026-01-01')
  })

  it("'quarter' Q3(7월) → 7월 1일 시작", () => {
    expect(resolvePeriod('quarter', '2026-07-01')?.start).toBe('2026-07-01')
  })

  it("'quarter' Q4(12월) → 10월 1일 시작", () => {
    expect(resolvePeriod('quarter', '2026-12-31')?.start).toBe('2026-10-01')
  })
})

describe('isInPeriod', () => {
  const range = { start: '2026-06-01', end: '2026-06-30' }

  it('range=null이면 항상 true (누적)', () => {
    expect(isInPeriod('2024-01-01', null)).toBe(true)
    expect(isInPeriod(null, null)).toBe(true)
  })

  it('날짜 없으면 기간 필터 시 false', () => {
    expect(isInPeriod(null, range)).toBe(false)
    expect(isInPeriod('', range)).toBe(false)
  })

  it('경계 포함', () => {
    expect(isInPeriod('2026-06-01', range)).toBe(true)
    expect(isInPeriod('2026-06-30', range)).toBe(true)
  })

  it('범위 밖은 false', () => {
    expect(isInPeriod('2026-05-31', range)).toBe(false)
    expect(isInPeriod('2026-07-01', range)).toBe(false)
  })

  it('timestamp(시간 포함)도 앞 10자리로 비교', () => {
    expect(isInPeriod('2026-06-15T09:30:00Z', range)).toBe(true)
  })
})

describe('isPeriodKey', () => {
  it('유효 키만 true', () => {
    expect(isPeriodKey('month')).toBe(true)
    expect(isPeriodKey('quarter')).toBe(true)
    expect(isPeriodKey('year')).toBe(true)
    expect(isPeriodKey('all')).toBe(true)
    expect(isPeriodKey('week')).toBe(false)
    expect(isPeriodKey(undefined)).toBe(false)
    expect(isPeriodKey(null)).toBe(false)
  })
})
