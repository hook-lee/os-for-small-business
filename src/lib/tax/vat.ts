import type { Transaction, VATResult } from '@/types/domain'
import { isVATDeductible } from '@/lib/categories/deduction-rules'

export type Quarter = 1 | 2 | 3 | 4

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
 * 분기별 부가세 시뮬레이션 (일반과세자 가정).
 *
 * 매출세액 = Σ(매출 카테고리 + amount > 0) × 10/110
 *           (공급대가 = 부가세 포함 표시 가정)
 * 매입세액 = Σ(isVATDeductible(tx)인 거래의 |amount|) × 10/110
 * 예상납부 = 매출세액 - 매입세액
 *
 * 단순화: 카드 매출도 공급대가(VAT 포함)로 처리. 카드 수수료 등 실제 신고 시 조정 필요할 수 있음.
 */
export function simulateVAT(
  transactions: Transaction[],
  year: number,
  quarter: Quarter,
): VATResult {
  const { start, end } = getQuarterRange(year, quarter)
  const inRange = transactions.filter(tx => isInRange(tx.date, start, end))

  const salesTotal = inRange
    .filter(tx => tx.category === '매출' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)
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
