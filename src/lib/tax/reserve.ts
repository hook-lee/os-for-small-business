import type { Transaction, ReserveRecommendation } from '@/types/domain'
import { simulateVAT, type Quarter } from './vat'
import { simulateIncomeTax, type IncomeTaxOptions } from './income-tax'

/**
 * 권장 월 예비비.
 *
 * 부가세: 연초~현재 분기의 estimatedVAT 합 × 4 / (경과 분기 수) → 연환산.
 *         (각 분기 estimatedVAT < 0이면 0으로 처리. 환급은 별도 KPI.)
 * 종소세: simulateIncomeTax 결과의 estimatedTax (이미 연환산 + 감면 반영).
 * 월 권장 = (vat연 + 소득세연) / 12, Math.round.
 */
export function recommendReserve(
  transactions: Transaction[],
  asOfDate: string,
  options: IncomeTaxOptions = {},
): ReserveRecommendation {
  const year = parseInt(asOfDate.slice(0, 4), 10)
  const month = parseInt(asOfDate.slice(5, 7), 10)
  const currentQuarter = Math.ceil(month / 3) as Quarter

  let vatSoFar = 0
  for (let q = 1; q <= currentQuarter; q++) {
    const result = simulateVAT(transactions, year, q as Quarter)
    vatSoFar += Math.max(0, result.estimatedVAT)
  }
  const vatTotal = Math.round((vatSoFar * 4) / currentQuarter)

  // 종소세는 연 1회(5월) 신고 → 연말(12월) 기준으로만 포함.
  // 분기 중간에는 부가세 납부 준비만 해도 되므로, 12월이 아닌 시점엔 0으로 처리.
  const incomeTaxTotal = month === 12
    ? simulateIncomeTax(transactions, asOfDate, options).estimatedTax
    : 0

  const annualTaxEstimate = vatTotal + incomeTaxTotal
  const monthly = Math.round(annualTaxEstimate / 12)

  return {
    monthly,
    annualTaxEstimate,
    breakdown: {
      vatTotal,
      incomeTaxTotal,
    },
  }
}
