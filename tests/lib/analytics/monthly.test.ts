import { describe, it, expect } from 'vitest'
import { aggregateMonthly } from '@/lib/analytics/monthly'
import type { Transaction, Category, PaymentMethod, TxClassification } from '@/types/domain'

function tx(date: string, category: Category, amount: number, classification: TxClassification = 'business'): Transaction {
  return {
    date, rawCategory: category, category, amount,
    method: '카드' as PaymentMethod,
    counterparty: undefined, person: undefined, classification,
    memo: undefined,
  }
}

describe('aggregateMonthly', () => {
  it('매출/지출/순이익 월별 집계', () => {
    const r = aggregateMonthly([
      tx('2026-01-15', '매출', 10_000_000),
      tx('2026-01-20', '임대료', -1_400_000),
      tx('2026-02-10', '매출', 11_000_000),
    ])
    const jan = r.find(m => m.month === '2026-01')!
    expect(jan.revenue).toBe(10_000_000)
    expect(jan.expense).toBe(1_400_000)
    expect(jan.net).toBe(8_600_000)
  })

  it('owner_draw, reserve 별도 집계', () => {
    const r = aggregateMonthly([
      tx('2026-01-15', '매출', 10_000_000),
      tx('2026-01-31', '유진 급여', -3_000_000, 'owner_draw'),
      tx('2026-01-31', '예비비', -1_800_000, 'reserve'),
    ])
    const jan = r.find(m => m.month === '2026-01')!
    expect(jan.expense).toBe(0)
    expect(jan.ownerDraw).toBe(3_000_000)
    expect(jan.reserve).toBe(1_800_000)
    expect(jan.net).toBe(10_000_000)  // 매출만 (owner_draw 제외)
  })

  it('owner_draw, reserve 별도 / business+living은 expense에 합산', () => {
    const r = aggregateMonthly([
      tx('2026-01-15', '매출', 10_000_000),
      tx('2026-01-20', '임대료', -1_400_000),           // business
      tx('2026-01-25', '식비', -500_000, 'living'),     // living — expense에 포함
      tx('2026-01-31', '유진 급여', -3_000_000, 'owner_draw'),
      tx('2026-01-31', '예비비', -1_800_000, 'reserve'),
    ])
    const jan = r.find(m => m.month === '2026-01')!
    expect(jan.revenue).toBe(10_000_000)
    expect(jan.expense).toBe(1_900_000)         // 임대료 + 식비
    expect(jan.businessExpense).toBe(1_400_000) // 임대료만
    expect(jan.ownerDraw).toBe(3_000_000)
    expect(jan.reserve).toBe(1_800_000)
    expect(jan.net).toBe(8_100_000)             // revenue - expense
  })

  it('빈 입력', () => {
    expect(aggregateMonthly([])).toEqual([])
  })

  it('월 순서대로', () => {
    const r = aggregateMonthly([
      tx('2026-03-01', '매출', 1_000_000),
      tx('2026-01-01', '매출', 1_000_000),
      tx('2026-02-01', '매출', 1_000_000),
    ])
    expect(r.map(m => m.month)).toEqual(['2026-01', '2026-02', '2026-03'])
  })
})
