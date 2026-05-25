/**
 * 세금 history 분석 — 과거 세금 실측 + 간이/일반 과세 전환 시뮬레이션.
 *
 * 라파 운영자 케이스:
 * - 2024-04 ~ 2025-06: 간이과세자 (15개월)
 * - 2025-07 ~ 2026-06: 일반과세자 (12개월)
 * - 2026-07 ~ : 직전 1년 매출 < 1억800만이면 간이 전환 가능
 *
 * 1억800만원 = 부가가치세법상 간이과세자 기준 (2024년 개정 후 기준)
 */
import type { Transaction } from '@/types/domain'

export const SIMPLIFIED_THRESHOLD = 108_000_000   // 1억800만원

export type TaxPayerType = 'simplified' | 'general'

export interface TaxPeriod {
  start: string   // 'YYYY-MM'
  end: string     // 'YYYY-MM' (inclusive)
  type: TaxPayerType
  monthCount: number
}

/**
 * 사용자 정의 과세 전환 타임라인.
 * 추후 settings 페이지에서 사용자가 수정 가능하도록 확장 가능.
 */
export const TAX_PERIODS: TaxPeriod[] = [
  { start: '2024-04', end: '2025-06', type: 'simplified', monthCount: 15 },
  { start: '2025-07', end: '2026-06', type: 'general',    monthCount: 12 },
]

export function getTaxPayerTypeAt(yearMonth: string): TaxPayerType {
  for (const p of TAX_PERIODS) {
    if (yearMonth >= p.start && yearMonth <= p.end) return p.type
  }
  // 정의된 기간 이후 → 간이 가능 (조건부, 매출 따라). 일단 simplified로 두고 UI에서 안내
  if (yearMonth > TAX_PERIODS[TAX_PERIODS.length - 1].end) return 'simplified'
  return 'general'
}

export interface QuarterlyVATEstimate {
  quarter: string         // '2024-Q2'
  startMonth: string
  endMonth: string
  revenue: number
  purchaseVATDeductible: number  // 매입세액 추정 (일반과세자만)
  type: TaxPayerType
  estimatedVAT: number
}

function quarterRange(year: number, q: 1 | 2 | 3 | 4): { start: string; end: string } {
  const startMonth = (q - 1) * 3 + 1
  const endMonth = startMonth + 2
  return {
    start: `${year}-${String(startMonth).padStart(2, '0')}`,
    end: `${year}-${String(endMonth).padStart(2, '0')}`,
  }
}

/**
 * 분기별 부가세 추정.
 * - 간이: 매출 × 30% × 10% = 매출의 3%
 * - 일반: 매출 × 10% - 매입세액 (매입 가능 카테고리만)
 */
export function computeQuarterlyVATHistory(txs: Transaction[]): QuarterlyVATEstimate[] {
  const VAT_DEDUCTIBLE_CATEGORIES = new Set([
    '임대료', '관리비', '공과금', '소모품', '소품', '도서인쇄비', '마케팅비', '정기결제',
  ])

  // 등장한 모든 (year, quarter) 추출
  const quarters = new Map<string, { year: number; q: 1 | 2 | 3 | 4 }>()
  for (const tx of txs) {
    const y = parseInt(tx.date.slice(0, 4), 10)
    const m = parseInt(tx.date.slice(5, 7), 10)
    const q = Math.ceil(m / 3) as 1 | 2 | 3 | 4
    quarters.set(`${y}-Q${q}`, { year: y, q })
  }

  const result: QuarterlyVATEstimate[] = []
  for (const key of [...quarters.keys()].sort()) {
    const { year, q } = quarters.get(key)!
    const { start, end } = quarterRange(year, q)
    let revenue = 0
    let purchaseDeductible = 0
    for (const tx of txs) {
      const ym = tx.date.slice(0, 7)
      if (ym < start || ym > end) continue
      const cat = tx.category ?? tx.rawCategory ?? ''
      if (tx.amount > 0 && cat === '매출') revenue += tx.amount
      else if (tx.amount < 0 && VAT_DEDUCTIBLE_CATEGORIES.has(cat)) {
        purchaseDeductible += Math.abs(tx.amount)
      }
    }
    // 해당 분기의 첫 달로 과세 유형 결정 (대부분의 경우 분기 내 동일)
    const type = getTaxPayerTypeAt(start)
    let estimatedVAT: number
    if (type === 'simplified') {
      estimatedVAT = Math.round(revenue * 0.30 * 0.10)
    } else {
      const outputVAT = Math.round(revenue * 0.10 / 1.10)  // 부가세 포함 매출이라 가정 (보수적)
      const inputVAT = Math.round(purchaseDeductible * 0.10 / 1.10)
      estimatedVAT = Math.max(0, outputVAT - inputVAT)
    }
    result.push({
      quarter: key,
      startMonth: start,
      endMonth: end,
      revenue,
      purchaseVATDeductible: purchaseDeductible,
      type,
      estimatedVAT,
    })
  }
  return result
}

/**
 * 직전 1년(rolling) 매출 → 간이 전환 조건 모니터링.
 */
export interface SimplifiedEligibility {
  rollingRevenue: number    // 직전 12개월 매출 합
  threshold: number
  isEligible: boolean       // < threshold → 간이 전환 가능
  remainingMargin: number   // threshold - rollingRevenue (음수면 초과)
  asOfMonth: string
}

export function checkSimplifiedEligibility(txs: Transaction[], asOfMonth?: string): SimplifiedEligibility {
  const now = asOfMonth ?? new Date().toISOString().slice(0, 7)
  const [y, m] = now.split('-').map(Number)
  // 직전 12개월: now 기준 m-12 ~ m (실은 m-1까지가 정석. 1년 전부터 이번 달 전까지)
  const startYear = m === 12 ? y : y - 1
  const startMonth = m === 12 ? 1 : m + 1
  const start = `${startYear}-${String(startMonth).padStart(2, '0')}`
  const end = `${y}-${String(m).padStart(2, '0')}`

  let revenue = 0
  for (const tx of txs) {
    const ym = tx.date.slice(0, 7)
    if (ym < start || ym > end) continue
    const cat = tx.category ?? tx.rawCategory ?? ''
    if (tx.amount > 0 && cat === '매출') revenue += tx.amount
  }

  return {
    rollingRevenue: revenue,
    threshold: SIMPLIFIED_THRESHOLD,
    isEligible: revenue < SIMPLIFIED_THRESHOLD,
    remainingMargin: SIMPLIFIED_THRESHOLD - revenue,
    asOfMonth: now,
  }
}

/**
 * 과거 실제 납부 세금 — transactions에서 '세금' 카테고리 + memo 키워드 기반.
 */
export interface ActualTaxRecord {
  yearMonth: string
  category: string              // '부가세' / '종소세' / '원천세' / '기타세금'
  amount: number                // positive
  memo: string | null
  date: string
}

export function extractActualTaxes(txs: Transaction[]): ActualTaxRecord[] {
  const result: ActualTaxRecord[] = []
  for (const tx of txs) {
    const cat = tx.category ?? tx.rawCategory ?? ''
    if (cat !== '세금') continue
    if (tx.amount >= 0) continue
    const memo = tx.memo ?? ''
    let taxCategory: string = '기타세금'
    if (memo.includes('부가세')) taxCategory = '부가세'
    else if (memo.includes('종소세') || memo.includes('종합소득세')) taxCategory = '종소세'
    else if (memo.includes('원천세')) taxCategory = '원천세'
    else if (memo.includes('지방세')) taxCategory = '지방세'
    result.push({
      yearMonth: tx.date.slice(0, 7),
      category: taxCategory,
      amount: Math.abs(tx.amount),
      memo: tx.memo ?? null,
      date: tx.date,
    })
  }
  return result.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * 세금 종류별 + 월별 집계
 */
export function aggregateTaxesByMonth(records: ActualTaxRecord[]): Array<{
  yearMonth: string
  byCategory: Record<string, number>
  total: number
}> {
  const map = new Map<string, { byCategory: Record<string, number>; total: number }>()
  for (const r of records) {
    if (!map.has(r.yearMonth)) {
      map.set(r.yearMonth, { byCategory: {}, total: 0 })
    }
    const entry = map.get(r.yearMonth)!
    entry.byCategory[r.category] = (entry.byCategory[r.category] ?? 0) + r.amount
    entry.total += r.amount
  }
  return [...map.keys()].sort().map(ym => ({ yearMonth: ym, ...map.get(ym)! }))
}
