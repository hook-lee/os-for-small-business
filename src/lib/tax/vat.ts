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
    // 간이과세자: 부가세 = 공급대가 × 부가율(서비스업 30%) × 세율(10%)
    //
    // ⚠️ 납부의무 면제(연 공급대가 4,800만 미만)는 '연간' 판정이라 분기 단위 함수에선 적용하지 않는다.
    //    (예전 버그: 분기 매출 × 4로 연환산해 분기마다 면제 판정 → 분기별로 0이 떴음.)
    //    면제는 simulateAnnualVAT()에서 연간 기준으로 한 번만 판정한다.
    const addedValueRate = options.simplifiedAddedValueRate ?? 0.30
    const estimatedVAT = Math.round(salesTotal * addedValueRate * 0.10)

    return {
      year,
      quarter,
      outputVAT: estimatedVAT,  // 간이는 그냥 추정 부가세 (부가율 반영)
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

/**
 * 연간 부가세 — 홈·세금탭·예비비가 공유하는 '단일 소스'.
 *
 * 간이과세자: 1년 1회 확정신고(다음해 1.25). 분기 개념 없음.
 *   - 연환산 공급대가(= YTD 매출 × 12/경과월) 가 4,800만 미만이면 납부의무 면제(0).
 *   - 아니면 부가세 = 연환산 공급대가 × 부가율(서비스업 30%) × 10%.
 * 일반과세자: YTD 분기별 (매출세액-매입세액) 합을 분기 기준 연환산(× 4/현재분기).
 *   - 납부기한: asOfDate가 7/25 전이면 당해 1기 확정(7/25), 이후면 다음해 2기 확정(1/25).
 */
export interface AnnualVATResult {
  year: number
  type: 'general' | 'simplified'
  annualizedSales: number       // 연환산 매출(공급대가)
  outputVAT: number             // 일반: 연환산 매출세액 / 간이: 0(부가율 적용 전이라 분리 안 함)
  inputVAT: number              // 일반: 연환산 매입세액 / 간이: 0
  exempt: boolean               // 간이 납부의무 면제 여부
  estimatedAnnualVAT: number    // 연간 예상 납부액
  dueDate: string               // 다음 확정신고 납부기한 (yyyy-mm-dd)
  filingLabel: string           // 사람용 라벨
  transactionCount: number
}

function monthsElapsedInYear(year: number, asOfDate: string): number {
  const y = parseInt(asOfDate.slice(0, 4), 10)
  const m = parseInt(asOfDate.slice(5, 7), 10)
  if (y > year) return 12
  if (y < year) return 1
  return Math.min(12, Math.max(1, m))
}

export function simulateAnnualVAT(
  transactions: Transaction[],
  year: number,
  asOfDate: string,
  options: VATOptions = {},
): AnnualVATResult {
  const type = options.taxPayerType ?? 'general'
  const yearStart = `${year}-01-01`
  const ytd = transactions.filter(tx => tx.date >= yearStart && tx.date <= asOfDate)
  const monthsElapsed = monthsElapsedInYear(year, asOfDate)
  const monthFactor = 12 / monthsElapsed

  const ytdSales = ytd
    .filter(tx => tx.category === '매출' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0)
  const annualizedSales = Math.round(ytdSales * monthFactor)

  if (type === 'simplified') {
    const rate = options.simplifiedAddedValueRate ?? 0.30
    const exemptionThreshold = options.simplifiedExemptionThreshold ?? 48_000_000
    const exempt = annualizedSales < exemptionThreshold
    const estimatedAnnualVAT = exempt ? 0 : Math.round(annualizedSales * rate * 0.10)
    const dueDate = `${year + 1}-01-25`
    return {
      year,
      type,
      annualizedSales,
      outputVAT: 0,
      inputVAT: 0,
      exempt,
      estimatedAnnualVAT,
      dueDate,
      filingLabel: `${dueDate} (${year}년 확정신고)`,
      transactionCount: ytd.length,
    }
  }

  // 일반과세자: 분기 기준 연환산 (× 4/현재분기) — 부가세는 분기 단위라 분기 기준이 자연스럽다.
  const currentQuarter = Math.min(4, Math.max(1, Math.ceil(monthsElapsed / 3)))
  const quarterFactor = 4 / currentQuarter
  let ytdOutput = 0
  let ytdInput = 0
  let ytdNet = 0
  for (let q = 1; q <= currentQuarter; q++) {
    const r = simulateVAT(transactions, year, q as Quarter, { taxPayerType: 'general' })
    ytdOutput += r.outputVAT
    ytdInput += r.inputVAT
    ytdNet += Math.max(0, r.estimatedVAT)
  }
  const estimatedAnnualVAT = Math.round(ytdNet * quarterFactor)
  const mmdd = asOfDate.slice(5)
  const before1stFinal = mmdd <= '07-25'
  const dueDate = before1stFinal ? `${year}-07-25` : `${year + 1}-01-25`
  return {
    year,
    type,
    annualizedSales,
    outputVAT: Math.round(ytdOutput * quarterFactor),
    inputVAT: Math.round(ytdInput * quarterFactor),
    exempt: false,
    estimatedAnnualVAT,
    dueDate,
    filingLabel: before1stFinal ? `${dueDate} (1기 확정)` : `${dueDate} (2기 확정)`,
    transactionCount: ytd.length,
  }
}
