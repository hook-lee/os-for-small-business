import { describe, it, expect } from 'vitest'
import { getUpcomingDueDates } from '@/lib/tax/due-dates'

describe('getUpcomingDueDates', () => {
  it('1월 1일 기준: 가장 가까운 부가세는 1/25', () => {
    const dues = getUpcomingDueDates('2026-01-01')
    expect(dues[0].type).toBe('VAT')
    expect(dues[0].date).toBe('2026-01-25')
    expect(dues[0].daysRemaining).toBe(24)
  })

  it('4월 1일 기준: 1/25 지났음, 다음은 4/25', () => {
    const dues = getUpcomingDueDates('2026-04-01')
    const firstVAT = dues.find(d => d.type === 'VAT')!
    expect(firstVAT.date).toBe('2026-04-25')
  })

  it('5월 1일 종소세 D-30', () => {
    const dues = getUpcomingDueDates('2026-05-01')
    const it = dues.find(d => d.type === 'INCOME_TAX')!
    expect(it.date).toBe('2026-05-31')
    expect(it.daysRemaining).toBe(30)
  })

  it('가까운 순서로 정렬', () => {
    const dues = getUpcomingDueDates('2026-01-15')
    for (let i = 1; i < dues.length; i++) {
      expect(dues[i].daysRemaining).toBeGreaterThanOrEqual(dues[i - 1].daysRemaining)
    }
  })

  it('모든 결과의 daysRemaining >= 0', () => {
    const dues = getUpcomingDueDates('2026-06-01')
    expect(dues.every(d => d.daysRemaining >= 0)).toBe(true)
  })

  it('12월 26일 시점에 당해 부가세 4개 + 종소세 모두 지나서 다음 해 1/25만 반환', () => {
    const dues = getUpcomingDueDates('2026-12-26')
    const vats = dues.filter(d => d.type === 'VAT')
    expect(vats).toHaveLength(1)
    expect(vats[0].date).toBe('2027-01-25')
  })

  it('납부일 당일은 포함 (daysRemaining 0)', () => {
    const dues = getUpcomingDueDates('2026-04-25')
    const apr25 = dues.find(d => d.date === '2026-04-25')
    expect(apr25).toBeDefined()
    expect(apr25!.daysRemaining).toBe(0)
  })
})
