import { describe, it, expect } from 'vitest'
import { REAL_TRANSACTIONS, GROUND_TRUTH_KPI } from '../fixtures/real-transactions'
import { classify } from '@/lib/categories/normalize'
import { aggregateMonthly } from '@/lib/analytics/monthly'
import { simulateVAT, type Quarter } from '@/lib/tax/vat'
import { simulateIncomeTax } from '@/lib/tax/income-tax'
import type { Transaction, Category } from '@/types/domain'

// Adapt RealTransaction → Transaction (add rawCategory + classification)
const txs: Transaction[] = REAL_TRANSACTIONS.map(t => ({
  date: t.date,
  rawCategory: t.category,
  category: t.category as Category,
  amount: t.amount,
  method: t.method,
  counterparty: t.counterparty || undefined,
  person: t.person || undefined,
  classification: classify(t.category as Category),
  memo: undefined,
}))

function withinPercent(actual: number, target: number, percent: number): boolean {
  if (target === 0) return Math.abs(actual) < 1
  return Math.abs(actual - target) / Math.abs(target) <= percent
}

describe('백테스트: aggregateMonthly vs Looker PDF KPI', () => {
  const monthly = aggregateMonthly(txs)

  it('2024년 매출 ±2%', () => {
    const total = monthly.filter(m => m.month.startsWith('2024'))
      .reduce((s, m) => s + m.revenue, 0)
    const target = GROUND_TRUTH_KPI[2024].revenue
    console.log(`2024 revenue: actual=${total.toLocaleString()}, target=${target.toLocaleString()}, diff=${(((total - target) / target) * 100).toFixed(2)}%`)
    expect(withinPercent(total, target, 0.02)).toBe(true)
  })

  it('2024년 사업비용 (owner_draw·reserve 제외) ±5%', () => {
    const total = monthly.filter(m => m.month.startsWith('2024'))
      .reduce((s, m) => s + m.expense, 0)
    const target = GROUND_TRUTH_KPI[2024].expense
    console.log(`2024 expense: actual=${total.toLocaleString()}, target=${target.toLocaleString()}, diff=${(((total - target) / target) * 100).toFixed(2)}%`)
    expect(withinPercent(total, target, 0.05)).toBe(true)
  })

  it('2024년 owner_draw (유진 급여) ±5%', () => {
    const total = monthly.filter(m => m.month.startsWith('2024'))
      .reduce((s, m) => s + m.ownerDraw, 0)
    const target = GROUND_TRUTH_KPI[2024].ownerDraw
    console.log(`2024 ownerDraw: actual=${total.toLocaleString()}, target=${target.toLocaleString()}, diff=${(((total - target) / target) * 100).toFixed(2)}%`)
    expect(withinPercent(total, target, 0.05)).toBe(true)
  })

  it('2025년 매출 ±2%', () => {
    const total = monthly.filter(m => m.month.startsWith('2025'))
      .reduce((s, m) => s + m.revenue, 0)
    const target = GROUND_TRUTH_KPI[2025].revenue
    console.log(`2025 revenue: actual=${total.toLocaleString()}, target=${target.toLocaleString()}, diff=${(((total - target) / target) * 100).toFixed(2)}%`)
    expect(withinPercent(total, target, 0.02)).toBe(true)
  })

  it('2025년 사업비용 ±5%', () => {
    const total = monthly.filter(m => m.month.startsWith('2025'))
      .reduce((s, m) => s + m.expense, 0)
    const target = GROUND_TRUTH_KPI[2025].expense
    console.log(`2025 expense: actual=${total.toLocaleString()}, target=${target.toLocaleString()}, diff=${(((total - target) / target) * 100).toFixed(2)}%`)
    expect(withinPercent(total, target, 0.05)).toBe(true)
  })

  it('2025년 owner_draw ±5%', () => {
    const total = monthly.filter(m => m.month.startsWith('2025'))
      .reduce((s, m) => s + m.ownerDraw, 0)
    const target = GROUND_TRUTH_KPI[2025].ownerDraw
    console.log(`2025 ownerDraw: actual=${total.toLocaleString()}, target=${target.toLocaleString()}, diff=${(((total - target) / target) * 100).toFixed(2)}%`)
    expect(withinPercent(total, target, 0.05)).toBe(true)
  })
})

describe('백테스트: 부가세 시뮬레이터 sanity check', () => {
  it('2025년 전체 분기 부가세 합계 > 0 (인적용역이라 매출 1억대 × ~9%)', () => {
    const total = [1, 2, 3, 4]
      .map(q => simulateVAT(txs, 2025, q as Quarter))
      .reduce((s, r) => s + Math.max(0, r.estimatedVAT), 0)
    console.log(`2025 VAT total estimate: ${total.toLocaleString()}원`)
    expect(total).toBeGreaterThan(8_000_000)   // 최소 800만 이상
    expect(total).toBeLessThan(13_000_000)     // 최대 1,300만 이하 (인적용역 가정)
  })
})

describe('백테스트: 종소세 시뮬레이터 sanity check', () => {
  it('2025년 12월 31일 기준 시뮬: 감면 0% — 산출세액 양수', () => {
    const r = simulateIncomeTax(txs, '2025-12-31', { youngStartupReduction: 0 })
    console.log(`2025 income tax (no reduction): annualizedRevenue=${r.annualizedRevenue.toLocaleString()}, businessIncome=${r.businessIncome.toLocaleString()}, estimatedTax=${r.estimatedTax.toLocaleString()}`)
    expect(r.computedTax).toBeGreaterThan(0)
  })

  it('청년창업감면 100% → 예상세액 0', () => {
    const r = simulateIncomeTax(txs, '2025-12-31', { youngStartupReduction: 1.0 })
    expect(r.estimatedTax).toBe(0)
  })

  it('연환산 매출이 PDF의 2025년 매출과 근사 ±5% (12월 시점)', () => {
    const r = simulateIncomeTax(txs, '2025-12-31')
    const target = GROUND_TRUTH_KPI[2025].revenue
    console.log(`2025 annualizedRevenue: ${r.annualizedRevenue.toLocaleString()} vs target ${target.toLocaleString()}, diff=${(((r.annualizedRevenue - target) / target) * 100).toFixed(2)}%`)
    expect(withinPercent(r.annualizedRevenue, target, 0.05)).toBe(true)
  })
})
