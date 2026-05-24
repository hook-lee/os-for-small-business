import type { Transaction, VATResult } from '@/types/domain'
import { isVATDeductible } from '@/lib/categories/deduction-rules'

export type Quarter = 1 | 2 | 3 | 4

export interface VATOptions {
  taxPayerType?: 'general' | 'simplified'
  /** 간이과세자 면제 기준 연환산 매출 (default: 48_000_000) */
  simplifiedExemptionThreshold?: number
  /** 간이과세자 부가율, 서비스업 기본 30% (default: 0.30) */
  simplifiedAddedValueRate?: number
}

/**
 * 분기 시작일·종료일 (한국 시간 기준, ISO YYYY-MM-DD).
 */
export function getQuarterRange(year: number, quarter: Quarter): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  // 다음 달의 0일 = 이번 달 마지막 일
  const lastDay = new Date(year, endMonth, 0).getDate()
  return {
    start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    end: `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

function isInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

/**
 * 분기별 부가세 시뮬레이션.
 *
 * 일반과세자:
 *   매출세액 = Σ(매출 카테고리 + amount > 0) × 10/110
 *   매입세액 = Σ(isVATDeductible(tx)인 거래의 |amount|) × 10/110
 *   예상납부 = 매출세액 - 매입세액
 *
 * 간이과세자 (서비스업 기준):
 *   부가율 30%, 세율 10% → 실효 3%
 *   분기 부가세 = 분기매출 × 0.30 × 0.10
 *   단, 연환산 매출(= 분기매출 × 4) < 4,800만원 → 면제(0원)
 *   매입세액 공제 없음 (단순화).
 */
export function simulateVAT(
  transactions: Transaction[],
  year: number,
  quarter: Quarter,
  options: VATOptions = {},
): VATResult {
  const { start, end } = getQuarterRange(year, quarter)
  const inRange = transactions.filter(tx => isInRange(tx.date, start, end))

  const salesTotal = inRange
    .filter(tx => tx.category === '매출' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)

  const taxPayerType = options.taxPayerType ?? 'general'

  if (taxPayerType === 'simplified') {
    // 간이과세자: 부가세 = 매출 × 부가율(30%) × 세율(10%)
    // 단, 연환산 매출이 면제 기준 미만이면 0
    const addedValueRate = options.simplifiedAddedValueRate ?? 0.30
    const exemptionThreshold = options.simplifiedExemptionThreshold ?? 48_000_000

    // 분기 매출 × 4 = 연환산
    const annualizedSales = salesTotal * 4
    let estimatedVAT = 0
    if (annualizedSales >= exemptionThreshold) {
      // 분기 부가세 = 분기 매출 × 부가율 × 10%
      estimatedVAT = Math.round(salesTotal * addedValueRate * 0.10)
    }

    return {
      year,
      quarter,
      outputVAT: estimatedVAT,  // 간이는 그냥 추정 부가세
      inputVAT: 0,  // 간이는 매입세액 공제 거의 없음 (생략)
      estimatedVAT,
      transactionCount: inRange.length,
    }
  }

  // 일반과세자 기존 로직
  const outputVAT = Math.round((salesTotal * 10) / 110)

  const deductibleTotal = inRange
    .filter(isVATDeductible)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const inputVAT = Math.round((deductibleTotal * 10) / 110)

  const estimatedVAT = outputVAT - inputVAT

  return {
    year,
    quarter,
    outputVAT,
    inputVAT,
    estimatedVAT,
    transactionCount: inRange.length,
  }
}
