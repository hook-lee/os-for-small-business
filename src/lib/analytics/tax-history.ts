/**
 * 세금 history 분석 — 과거 세금 실측 + 간이/일반 과세 전환 시뮬레이션.
 *
 * ⚠️ 과세 유형 타임라인은 하드코딩하지 않는다 — 각 원장이 설정하기 나름.
 * `buildTaxPeriods()`가 프로필(사업 개시 연월 · 현재 과세 유형 · 일반 전환 연월)로부터
 * 타임라인을 생성한다. 기본값: 사업 개시일부터 현재 과세 유형의 단일 기간.
 *
 * 1억400만원 = 부가가치세법상 간이과세자 적용 기준 (2024.7.1 개정 후 — 법령값이라 공통).
 *   직전 1년 공급대가가 이 금액 이상이면 다음 과세기간(7월)부터 일반과세자로 강제 전환,
 *   미만이면 간이 유지(일반과세자는 간이로 복귀 가능). 부동산임대·과세유흥은 4,800만원(별도).
 */
import type { Transaction } from '@/types/domain'

export const SIMPLIFIED_THRESHOLD = 104_000_000   // 1억400만원 (2024.7.1~)

export type TaxPayerType = 'simplified' | 'general'

export interface TaxPeriod {
  start: string   // 'YYYY-MM'
  end: string     // 'YYYY-MM' (inclusive)
  type: TaxPayerType
  monthCount: number
  ongoing?: boolean   // 진행 중인 (현재) 기간이면 true
}

export interface TaxTimelineInput {
  /** 사업 개시 연월 ('YYYY-MM'). 미설정 시 fallbackStartMonth → asOfMonth 순으로 fallback. */
  startMonth?: string | null
  /** 현재 과세 유형 (profile.taxPayerType). */
  currentType: TaxPayerType
  /** 일반과세 전환 연월 ('YYYY-MM'). null이면 전환 없이 단일 기간(currentType). */
  generalSinceMonth?: string | null
  /** startMonth 미설정 시 사용할 거래 데이터의 첫 달. */
  fallbackStartMonth?: string | null
  /** 기준 '현재' 월. 기본 = 오늘. */
  asOfMonth?: string
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function monthCountInclusive(start: string, end: string): number {
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1)
}

/**
 * 프로필 입력으로부터 과세 유형 타임라인 생성.
 * - generalSinceMonth가 개시월보다 뒤면: 간이(개시~전환전월) → 일반(전환월~현재) 2구간.
 * - 그 외: 현재 유형 단일 구간(개시~현재).
 * (간이↔일반을 여러 번 오간 복잡한 이력은 단일 전환 모델로 표현 — 추후 확장 가능.)
 */
export function buildTaxPeriods(input: TaxTimelineInput): TaxPeriod[] {
  const now = input.asOfMonth ?? new Date().toISOString().slice(0, 7)
  const start = input.startMonth || input.fallbackStartMonth || now
  const gs = input.generalSinceMonth

  if (gs && gs > start) {
    const simpleEnd = prevMonth(gs)
    const generalEnd = now >= gs ? now : gs
    return [
      { start, end: simpleEnd, type: 'simplified', monthCount: monthCountInclusive(start, simpleEnd) },
      { start: gs, end: generalEnd, type: 'general', monthCount: monthCountInclusive(gs, generalEnd), ongoing: true },
    ]
  }

  const end = now >= start ? now : start
  return [
    { start, end, type: input.currentType, monthCount: monthCountInclusive(start, end), ongoing: true },
  ]
}

export function getTaxPayerTypeAt(periods: TaxPeriod[], yearMonth: string): TaxPayerType {
  for (const p of periods) {
    if (yearMonth >= p.start && yearMonth <= p.end) return p.type
  }
  if (periods.length === 0) return 'general'
  // 정의된 기간 밖 → 가장 가까운 경계의 유형 사용
  if (yearMonth < periods[0].start) return periods[0].type
  return periods[periods.length - 1].type
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
export function computeQuarterlyVATHistory(txs: Transaction[], periods: TaxPeriod[]): QuarterlyVATEstimate[] {
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
    const type = getTaxPayerTypeAt(periods, start)
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
