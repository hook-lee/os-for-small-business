import { describe, it, expect } from 'vitest'
import { computeBracketTax, TAX_BRACKETS } from '@/lib/tax/brackets'
import { simulateIncomeTax } from '@/lib/tax/income-tax'
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

describe('computeBracketTax (누진세율)', () => {
  it('과세표준 0 → 세금 0', () => {
    expect(computeBracketTax(0)).toBe(0)
  })

  it('음수 입력은 0 처리', () => {
    expect(computeBracketTax(-100_000)).toBe(0)
  })

  it('1,000만원 → 1구간 (6%) → 60만', () => {
    expect(computeBracketTax(10_000_000)).toBe(600_000)
  })

  it('5,000만원: 1400만×6% + 3600만×15% = 84만 + 540만 = 624만', () => {
    expect(computeBracketTax(50_000_000)).toBe(6_240_000)
  })

  it('1.5억원: 24% 구간까지: 84만 + 540만 + 912만 + 2170만 = 3706만', () => {
    // 1400×6% + 3600×15% + 3800×24% + (15000-8800)×35% = 84 + 540 + 912 + 2170 = 3706만
    expect(computeBracketTax(150_000_000)).toBe(37_060_000)
  })

  it('TAX_BRACKETS는 8개 구간이고 마지막 upTo=Infinity', () => {
    expect(TAX_BRACKETS).toHaveLength(8)
    expect(TAX_BRACKETS[TAX_BRACKETS.length - 1].upTo).toBe(Infinity)
  })
})

describe('simulateIncomeTax', () => {
  it('영업이익 4800만 기준: 연환산 + 인적공제 후 종소세 계산', () => {
    // 매출 1억, 비용 5200만 → 영업이익 4800만 (12개월 데이터)
    const txs: Transaction[] = [
      tx('2026-06-15', '매출', 100_000_000),
      tx('2026-06-01', '임대료', -50_000_000, '계좌이체'),
      tx('2026-06-15', '마케팅비', -2_000_000, '카드'),
    ]
    const r = simulateIncomeTax(txs, '2026-12-31')
    expect(r.annualizedRevenue).toBe(100_000_000)
    expect(r.annualizedExpense).toBe(52_000_000)
    expect(r.businessIncome).toBe(48_000_000)
    // 과세표준 = 4800만 - 150만(인적1) = 4650만
    expect(r.taxableBase).toBe(46_500_000)
    expect(r.estimatedTax).toBeGreaterThan(0)
  })

  it('owner_draw(유진 급여)는 사업비용에 안 들어감', () => {
    const txs: Transaction[] = [
      tx('2026-06-15', '매출', 100_000_000),
      tx('2026-06-30', '유진 급여', -36_000_000, '계좌이체'),
    ]
    const r = simulateIncomeTax(txs, '2026-12-31')
    expect(r.annualizedExpense).toBe(0)
    expect(r.businessIncome).toBe(100_000_000)
  })

  it('reserve(예비비)도 사업비용에 안 들어감', () => {
    const txs: Transaction[] = [
      tx('2026-06-15', '매출', 100_000_000),
      tx('2026-06-30', '예비비', -21_600_000, '계좌이체'),
    ]
    const r = simulateIncomeTax(txs, '2026-12-31')
    expect(r.annualizedExpense).toBe(0)
  })

  it('생활비(식비)는 사업비용에 안 들어감 (incomeTaxDeductible=false)', () => {
    const txs: Transaction[] = [
      tx('2026-06-15', '매출', 100_000_000),
      tx('2026-06-30', '식비', -5_000_000, '카드'),
    ]
    const r = simulateIncomeTax(txs, '2026-12-31')
    expect(r.annualizedExpense).toBe(0)
  })

  it('경조사비는 사업비용 인정 (incomeTaxDeductible=true)', () => {
    const txs: Transaction[] = [
      tx('2026-06-15', '매출', 100_000_000),
      tx('2026-06-30', '경조사비', -500_000, '계좌이체'),
    ]
    const r = simulateIncomeTax(txs, '2026-12-31')
    expect(r.annualizedExpense).toBe(500_000)
  })

  it('6개월 데이터 연환산: 영업이익 3000만(6개월) → 연환산 6000만', () => {
    const txs: Transaction[] = [
      tx('2026-01-15', '매출', 60_000_000),
      tx('2026-01-01', '임대료', -30_000_000, '계좌이체'),
    ]
    const r = simulateIncomeTax(txs, '2026-06-30')
    expect(r.annualizedRevenue).toBe(120_000_000)
    expect(r.annualizedExpense).toBe(60_000_000)
    expect(r.businessIncome).toBe(60_000_000)
  })

  it('청년창업감면 100% → 산출세액 X 0 → 예상세액 0', () => {
    const txs: Transaction[] = [
      tx('2026-06-15', '매출', 100_000_000),
      tx('2026-06-01', '임대료', -50_000_000, '계좌이체'),
    ]
    const r = simulateIncomeTax(txs, '2026-12-31', { youngStartupReduction: 1.0 })
    expect(r.estimatedTax).toBe(0)
    expect(r.computedTax).toBeGreaterThan(0)  // 산출세액 자체는 0 아님
  })

  it('청년창업감면 50% → 예상세액 절반', () => {
    const txs: Transaction[] = [
      tx('2026-06-15', '매출', 100_000_000),
      tx('2026-06-01', '임대료', -50_000_000, '계좌이체'),
    ]
    const r0 = simulateIncomeTax(txs, '2026-12-31', { youngStartupReduction: 0 })
    const r50 = simulateIncomeTax(txs, '2026-12-31', { youngStartupReduction: 0.5 })
    // 50% 감면 시 예상세액은 0% 대비 약 절반 (반올림 오차 허용)
    expect(Math.abs(r50.estimatedTax - r0.estimatedTax * 0.5)).toBeLessThan(1000)
  })

  it('인적공제 인원 2명: 표준세액공제 제외 외 인적공제 300만', () => {
    const txs: Transaction[] = [
      tx('2026-06-15', '매출', 100_000_000),
      tx('2026-06-01', '임대료', -50_000_000, '계좌이체'),
    ]
    const r1 = simulateIncomeTax(txs, '2026-12-31', { personalDeductionCount: 1 })
    const r2 = simulateIncomeTax(txs, '2026-12-31', { personalDeductionCount: 2 })
    expect(r2.taxableBase).toBe(r1.taxableBase - 1_500_000)
  })

  it('노란우산공제·연금저축 반영', () => {
    const txs: Transaction[] = [
      tx('2026-06-15', '매출', 100_000_000),
      tx('2026-06-01', '임대료', -50_000_000, '계좌이체'),
      tx('2026-06-15', '마케팅비', -2_000_000, '카드'),
    ]
    const r = simulateIncomeTax(txs, '2026-12-31', {
      noranusanContribution: 3_000_000,
      pensionSavings: 4_000_000,
    })
    // 과세표준 = 4800만 - 150만(인적) - 300만(노란우산) - 400만(연금저축) = 3950만
    expect(r.taxableBase).toBe(39_500_000)
  })

  it('과세표준이 0 이하면 예상세액 0', () => {
    const txs: Transaction[] = [
      tx('2026-06-15', '매출', 1_000_000),  // 매우 작음
      tx('2026-06-01', '임대료', -500_000, '계좌이체'),
    ]
    const r = simulateIncomeTax(txs, '2026-12-31', { personalDeductionCount: 1 })
    expect(r.taxableBase).toBe(0)
    expect(r.estimatedTax).toBe(0)
  })
})
