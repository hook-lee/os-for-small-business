import type { Transaction, IncomeTaxResult } from '@/types/domain'
import { getTaxAttributes } from '@/lib/categories/mapping'
import { computeBracketTax } from './brackets'

const DEFAULT_PERSONAL_DEDUCTION = 1_500_000  // 본인 인적공제 (1명당)
const STANDARD_TAX_CREDIT = 70_000             // 표준세액공제
const PENSION_CREDIT_LIMIT = 6_000_000         // 연금저축 세액공제 한도 (IRP 합산 900만은 단순화 위해 미반영)
const LOCAL_TAX_RATE = 0.10                    // 지방소득세 = 종소세(국세) × 10%

/**
 * 노란우산공제(소기업·소상공인 공제) 소득공제 한도 (2025 상향).
 * 사업소득금액 4천만 이하 600만 / 4천~1억 400만 / 1억 초과 200만.
 */
function noranusanLimit(businessIncome: number): number {
  if (businessIncome <= 40_000_000) return 6_000_000
  if (businessIncome <= 100_000_000) return 4_000_000
  return 2_000_000
}

/**
 * 연금저축 세액공제율: 종합소득금액 4,500만 이하 15% / 초과 12% (지방세 별도).
 */
function pensionCreditRate(businessIncome: number): number {
  return businessIncome <= 45_000_000 ? 0.15 : 0.12
}

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
  // 노란우산: 한도 cap 적용 (소득공제)
  const noranusan = Math.min(options.noranusanContribution ?? 0, noranusanLimit(businessIncome))
  // 연금저축은 소득공제가 아니라 '세액공제' — 과세표준에서 빼지 않고 산출세액에서 차감한다.
  const pension = options.pensionSavings ?? 0
  const pensionCredit = Math.round(
    Math.min(pension, PENSION_CREDIT_LIMIT) * pensionCreditRate(businessIncome),
  )

  const taxableBase = Math.max(0, businessIncome - personalDeduction - noranusan)
  const computedTax = computeBracketTax(taxableBase)

  // 세액공제: 표준세액공제 + 연금저축 세액공제 + 기타
  const taxCredits = STANDARD_TAX_CREDIT + pensionCredit + (options.additionalTaxCredit ?? 0)
  const afterCredits = Math.max(0, computedTax - taxCredits)

  // 청년창업감면 (afterCredits에 비율 적용)
  const reduction = options.youngStartupReduction ?? 0
  const nationalTax = Math.round(afterCredits * (1 - reduction))   // 종합소득세(국세)
  const localTax = Math.round(nationalTax * LOCAL_TAX_RATE)        // 지방소득세
  const totalTax = nationalTax + localTax                          // 실제 빠져나가는 총액
  const estimatedTax = nationalTax                                 // 하위호환: 국세분

  return {
    year,
    annualizedRevenue,
    annualizedExpense,
    businessIncome,
    taxableBase,
    computedTax,
    estimatedTax,
    nationalTax,
    localTax,
    totalTax,
    pensionCredit,
    filingYear: year + 1,
    asOfDate,
  }
}
