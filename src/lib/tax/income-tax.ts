import type { Transaction, IncomeTaxResult } from '@/types/domain'
import { getTaxAttributes } from '@/lib/categories/mapping'
import { computeBracketTax } from './brackets'

const DEFAULT_PERSONAL_DEDUCTION = 1_500_000  // 본인 인적공제 (1명당)
const STANDARD_TAX_CREDIT = 70_000             // 표준세액공제

export interface IncomeTaxOptions {
  personalDeductionCount?: number              // 인적공제 인원 (디폴트 1)
  noranusanContribution?: number               // 노란우산공제 연 납입액
  pensionSavings?: number                      // 연금저축 연 납입액
  additionalTaxCredit?: number                 // 기타 세액공제
  youngStartupReduction?: 0 | 0.5 | 1.0        // 청년창업감면 비율
}

export function simulateIncomeTax(
  transactions: Transaction[],
  asOfDate: string,
  options: IncomeTaxOptions = {},
): IncomeTaxResult {
  const year = parseInt(asOfDate.slice(0, 4), 10)
  const yearStart = `${year}-01-01`
  const inYear = transactions.filter(tx => tx.date >= yearStart && tx.date <= asOfDate)

  const startDate = new Date(yearStart)
  const endDate = new Date(asOfDate)
  const monthsElapsed = Math.max(
    1,
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) + 1,
  )
  const annualizationFactor = 12 / monthsElapsed

  const revenueSoFar = inYear
    .filter(tx => tx.category === '매출' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)

  // 필요경비 = 사업비 + 종소세 인정되는 항목들
  // (owner_draw / reserve / capital / living은 제외 — getTaxAttributes().incomeTaxDeductible로 게이트)
  const expenseSoFar = inYear
    .filter(tx => {
      if (tx.amount >= 0) return false
      return getTaxAttributes(tx.category).incomeTaxDeductible
    })
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  const annualizedRevenue = Math.round(revenueSoFar * annualizationFactor)
  const annualizedExpense = Math.round(expenseSoFar * annualizationFactor)
  const businessIncome = annualizedRevenue - annualizedExpense

  const personalDeduction = (options.personalDeductionCount ?? 1) * DEFAULT_PERSONAL_DEDUCTION
  const noranusan = options.noranusanContribution ?? 0
  const pension = options.pensionSavings ?? 0

  const taxableBase = Math.max(0, businessIncome - personalDeduction - noranusan - pension)
  const computedTax = computeBracketTax(taxableBase)
  const taxCredits = STANDARD_TAX_CREDIT + (options.additionalTaxCredit ?? 0)
  const afterCredits = Math.max(0, computedTax - taxCredits)
  const reduction = options.youngStartupReduction ?? 0
  const estimatedTax = Math.round(afterCredits * (1 - reduction))

  return {
    year,
    annualizedRevenue,
    annualizedExpense,
    businessIncome,
    taxableBase,
    computedTax,
    estimatedTax,
    asOfDate,
  }
}
