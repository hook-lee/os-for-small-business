import { describe, it, expect } from 'vitest'
import { recommendReserve } from '@/lib/tax/reserve'
import type { Transaction, Category, PaymentMethod } from '@/types/domain'

function tx(date: string, category: Category, amount: number, method: PaymentMethod = '카드'): Transaction {
  return {
    date,
    rawCategory: category,
    category,
    amount,
    method,
    counterparty: undefined,
    person: undefined,
    classification: amount > 0
      ? 'business'
      : (category === '유진 급여' ? 'owner_draw'
        : category === '예비비' ? 'reserve'
        : (['자산', '보통예금', '사무용품'] as Category[]).includes(category) ? 'capital'
        : (['식비', '품위유지비', '교통비', '의류비', '의료비', '소품', '도서인쇄비', '소모품', '기타'] as Category[]).includes(category) ? 'living'
        : 'business'),
    memo: undefined,
  }
}

describe('recommendReserve', () => {
  it('빈 거래: 권장 0', () => {
    const r = recommendReserve([], '2026-01-31')
    expect(r.monthly).toBe(0)
    expect(r.breakdown.vatTotal).toBe(0)
    expect(r.breakdown.incomeTaxTotal).toBe(0)
  })

  it('1분기 매출 1100만, 매입 0 → 부가세 100만/분기 → 연 400만 → 종소세도 포함', () => {
    // 1Q에 1100만 매출. 부가세 = 100만. 연환산 = 400만. 종소세도 항상 포함.
    const r = recommendReserve(
      [tx('2026-01-15', '매출', 11_000_000)],
      '2026-03-31',
    )
    expect(r.breakdown.vatTotal).toBe(4_000_000)
    expect(r.breakdown.incomeTaxTotal).toBeGreaterThan(0)
    expect(r.monthly).toBe(Math.round(r.annualTaxEstimate / 12))
  })

  it('영업이익이 크면 종소세도 포함', () => {
    // 매출 1억(연환산), 비용 0 → 사업소득 1억 → 종소세 큼
    const r = recommendReserve(
      [tx('2026-01-15', '매출', 100_000_000)],
      '2026-12-31',
    )
    expect(r.breakdown.incomeTaxTotal).toBeGreaterThan(0)
  })

  it('청년창업감면 100% 시 종소세 0 → 권장 월은 부가세/12만', () => {
    const r = recommendReserve(
      [tx('2026-01-15', '매출', 100_000_000)],
      '2026-12-31',
      { youngStartupReduction: 1.0 },
    )
    expect(r.breakdown.incomeTaxTotal).toBe(0)
    expect(r.breakdown.vatTotal).toBeGreaterThan(0)
    expect(r.monthly).toBe(Math.round(r.breakdown.vatTotal / 12))
  })

  it('breakdown: vatTotal + incomeTaxTotal == annualTaxEstimate', () => {
    const r = recommendReserve(
      [tx('2026-01-15', '매출', 100_000_000)],
      '2026-06-30',
    )
    expect(r.annualTaxEstimate).toBe(r.breakdown.vatTotal + r.breakdown.incomeTaxTotal)
  })

  it('월 권장 = 연 예상세금 / 12, 반올림', () => {
    const r = recommendReserve(
      [tx('2026-01-15', '매출', 100_000_000)],
      '2026-12-31',
    )
    expect(r.monthly).toBe(Math.round(r.annualTaxEstimate / 12))
  })

  it('1월 종료 시점에 1분기 부가세를 전체 분기로 연환산 X 4', () => {
    // 1월에 매출 1100만 → 1Q 부가세 추정 100만. 1분기까지 데이터로 연 환산은 × 4.
    const r = recommendReserve(
      [tx('2026-01-15', '매출', 11_000_000)],
      '2026-01-31',
    )
    // 현재 분기는 Q1. 그 Q1의 estimatedVAT = 1,000,000. 연환산 = 1,000,000 * 4/1 = 4,000,000.
    expect(r.breakdown.vatTotal).toBe(4_000_000)
  })
})
