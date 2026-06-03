import type { Transaction, ReserveRecommendation } from '@/types/domain'
import { simulateAnnualVAT, type VATOptions } from './vat'
import { simulateIncomeTax, type IncomeTaxOptions } from './income-tax'

export interface ReserveOptions extends IncomeTaxOptions {
  taxPayerType?: 'general' | 'simplified'
  /** 간이과세자 납부의무 면제 기준 (연 공급대가). simulateAnnualVAT로 전달. */
  simplifiedExemptionThreshold?: number
  /** 간이과세자 부가율. simulateAnnualVAT로 전달. */
  simplifiedAddedValueRate?: number
}

/**
 * 권장 월 예비비. — 부가세·종소세 엔진의 '단일 소스'를 그대로 합산한다.
 *
 * 부가세: simulateAnnualVAT (일반=분기기준 연환산 / 간이=연환산 공급대가 + 면제 판정).
 * 종소세: simulateIncomeTax의 totalTax (국세 + 지방세, 연환산 + 감면 반영).
 * 월 권장 = (부가세연 + 종소세연) / 12, Math.round.
 */
export function recommendReserve(
  transactions: Transaction[],
  asOfDate: string,
  options: ReserveOptions = {},
): ReserveRecommendation {
  const year = parseInt(asOfDate.slice(0, 4), 10)

  const vatOptions: VATOptions = {
    taxPayerType: options.taxPayerType ?? 'general',
    simplifiedExemptionThreshold: options.simplifiedExemptionThreshold,
    simplifiedAddedValueRate: options.simplifiedAddedValueRate,
  }
  const vatResult = simulateAnnualVAT(transactions, year, asOfDate, vatOptions)
  const vatTotal = Math.max(0, vatResult.estimatedAnnualVAT)

  const incomeTaxResult = simulateIncomeTax(transactions, asOfDate, options)
  const incomeTaxTotal = incomeTaxResult.totalTax   // 국세 + 지방세

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
