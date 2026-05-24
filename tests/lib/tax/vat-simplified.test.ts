import { describe, it, expect } from 'vitest'
import { simulateVAT } from '@/lib/tax/vat'
import type { Transaction, Category, PaymentMethod } from '@/types/domain'

function tx(date: string, category: Category, amount: number, method: PaymentMethod = '카드'): Transaction {
  return { date, rawCategory: category, category, amount, method, counterparty: undefined, person: undefined, classification: 'business', memo: undefined }
}

describe('simulateVAT - simplified taxpayer (간이과세자)', () => {
  it('연환산 매출 4800만 미만 → 부가세 0 (면제)', () => {
    // 1분기 매출 1000만 → 연환산 4000만 (4800만 미만)
    const r = simulateVAT([tx('2026-01-15', '매출', 10_000_000)], 2026, 1, { taxPayerType: 'simplified' })
    expect(r.estimatedVAT).toBe(0)
  })

  it('연환산 매출 4800만 이상 → 매출 × 3% (서비스업)', () => {
    // 1분기 매출 2000만 → 연환산 8000만 (면제 안 됨)
    const r = simulateVAT([tx('2026-01-15', '매출', 20_000_000)], 2026, 1, { taxPayerType: 'simplified' })
    // 분기 부가세 = 2000만 × 0.30 × 0.10 = 60만
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
