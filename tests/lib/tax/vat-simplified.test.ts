import { describe, it, expect } from 'vitest'
import { simulateVAT, simulateAnnualVAT } from '@/lib/tax/vat'
import type { Transaction, Category, PaymentMethod } from '@/types/domain'

function tx(date: string, category: Category, amount: number, method: PaymentMethod = '카드'): Transaction {
  return { date, rawCategory: category, category, amount, method, counterparty: undefined, person: undefined, classification: 'business', memo: undefined }
}

describe('simulateVAT - 간이과세자 (분기 단위, 면제 판정 없음)', () => {
  it('분기 부가세 = 매출 × 30% × 10% (면제는 연간 함수에서 판정)', () => {
    // 1분기 매출 1000만 → 100만 × 0.30 = 30만. (분기 함수는 연환산 면제 판정 안 함)
    const r = simulateVAT([tx('2026-01-15', '매출', 10_000_000)], 2026, 1, { taxPayerType: 'simplified' })
    expect(r.estimatedVAT).toBe(300_000)
  })

  it('매출 2000만 → 2000만 × 30% × 10% = 60만', () => {
    const r = simulateVAT([tx('2026-01-15', '매출', 20_000_000)], 2026, 1, { taxPayerType: 'simplified' })
    expect(r.estimatedVAT).toBe(600_000)
  })

  it('간이과세자는 매입세액 공제 없음 (단순화)', () => {
    const r = simulateVAT([
      tx('2026-01-15', '매출', 20_000_000),
      tx('2026-01-20', '임대료', -2_000_000, '계좌이체'),
    ], 2026, 1, { taxPayerType: 'simplified' })
    expect(r.inputVAT).toBe(0)
  })

  it('일반과세자 분기 룰 변화 없음 (기본값)', () => {
    const r = simulateVAT([tx('2026-01-15', '매출', 11_000_000)], 2026, 1)
    expect(r.outputVAT).toBe(1_000_000)
  })
})

describe('simulateAnnualVAT - 간이과세자 (연간 단위, 납부의무 면제)', () => {
  it('연환산 공급대가 4800만 미만 → 면제(0)', () => {
    // 1분기(1~3월) 매출 1000만 → 연환산 4000만 < 4800만 → 면제
    const r = simulateAnnualVAT([tx('2026-01-15', '매출', 10_000_000)], 2026, '2026-03-31', { taxPayerType: 'simplified' })
    expect(r.annualizedSales).toBe(40_000_000)
    expect(r.exempt).toBe(true)
    expect(r.estimatedAnnualVAT).toBe(0)
  })

  it('연환산 공급대가 4800만 이상 → 연환산 × 30% × 10%', () => {
    // 1분기 매출 2000만 → 연환산 8000만 → 면제 안 됨
    const r = simulateAnnualVAT([tx('2026-01-15', '매출', 20_000_000)], 2026, '2026-03-31', { taxPayerType: 'simplified' })
    expect(r.annualizedSales).toBe(80_000_000)
    expect(r.exempt).toBe(false)
    expect(r.estimatedAnnualVAT).toBe(2_400_000)  // 8000만 × 0.30 × 0.10
  })

  it('간이 확정신고 납부기한 = 다음해 1월 25일', () => {
    const r = simulateAnnualVAT([tx('2026-01-15', '매출', 20_000_000)], 2026, '2026-06-30', { taxPayerType: 'simplified' })
    expect(r.dueDate).toBe('2027-01-25')
  })
})
