/**
 * 월별 요약 — Excel 우측 패널 형태로 구성.
 *
 * 좌측 (사업): 매출 + 사업 비용 8개 → 영업이익
 * 우측 (개인): 개인 비용 12개 → 순수익
 * 결제수단별 매출: 카드 / 계좌이체 / 현금
 */
import type { Transaction } from '@/types/domain'

// 사업 비용 분류 (xlsx 우측 상단)
export const BUSINESS_COST_CATEGORIES = [
  '급여', '유진 급여', '예비비', '임대료', '관리비',
  '세금', '공과금', '보험료', '정기결제',
] as const

// 개인 비용 분류 (xlsx 우측 하단)
export const PERSONAL_COST_CATEGORIES = [
  '교통비', '품위유지비', '교육비', '식비', '의류비', '의료비',
  '소모품', '소품', '도서인쇄비', '마케팅비', '경조사비', '수수료',
] as const

// 제외 (매출/자본성/대표자급여) — 비용 합계에 포함 X
const EXCLUDED_FROM_COSTS = new Set([
  '매출', '자산', '보통예금', '사무용품', '대표자급여',
])

export interface MonthlySummary {
  yearMonth: string                // 'YYYY-MM'
  revenue: number                  // 매출 (positive)
  revenueByMethod: {
    card: number
    transfer: number               // 계좌이체
    cash: number
    other: number                  // 나머지 결제수단
  }
  revenueCountByMethod: {
    card: number
    transfer: number
    cash: number
    other: number
  }
  businessCosts: Record<string, number>   // category → amount (always positive)
  businessCostTotal: number
  operatingProfit: number                  // 매출 - 사업 비용
  personalCosts: Record<string, number>
  personalCostTotal: number
  netProfit: number                         // 영업이익 - 개인 비용
  otherCosts: number                        // 분류 안 된 지출 (제외 카테고리 외)
  transactionCount: number
}

function emptySummary(yearMonth: string): MonthlySummary {
  const businessCosts: Record<string, number> = {}
  for (const c of BUSINESS_COST_CATEGORIES) businessCosts[c] = 0
  const personalCosts: Record<string, number> = {}
  for (const c of PERSONAL_COST_CATEGORIES) personalCosts[c] = 0
  return {
    yearMonth,
    revenue: 0,
    revenueByMethod: { card: 0, transfer: 0, cash: 0, other: 0 },
    revenueCountByMethod: { card: 0, transfer: 0, cash: 0, other: 0 },
    businessCosts,
    businessCostTotal: 0,
    operatingProfit: 0,
    personalCosts,
    personalCostTotal: 0,
    netProfit: 0,
    otherCosts: 0,
    transactionCount: 0,
  }
}

function methodKey(m: string | undefined): 'card' | 'transfer' | 'cash' | 'other' {
  if (!m) return 'other'
  const t = m.trim()
  if (t === '카드') return 'card'
  if (t === '계좌이체') return 'transfer'
  if (t === '현금') return 'cash'
  return 'other'
}

function getCategory(tx: Transaction): string {
  // category 우선, 없으면 rawCategory
  return tx.category ?? tx.rawCategory ?? ''
}

export function computeMonthlySummary(txs: Transaction[], yearMonth: string): MonthlySummary {
  const s = emptySummary(yearMonth)
  const businessSet: ReadonlySet<string> = new Set(BUSINESS_COST_CATEGORIES)
  const personalSet: ReadonlySet<string> = new Set(PERSONAL_COST_CATEGORIES)

  for (const tx of txs) {
    if (!tx.date.startsWith(yearMonth)) continue
    s.transactionCount++

    const cat = getCategory(tx)
    const amt = tx.amount

    if (amt > 0) {
      // 매출 — '매출' 카테고리만 진짜 매출로 (다른 양수는 제외)
      if (cat === '매출') {
        s.revenue += amt
        const k = methodKey(tx.method)
        s.revenueByMethod[k] += amt
        s.revenueCountByMethod[k]++
      }
      // 그 외 양수는 환불/조정성. 일단 무시
      continue
    }

    if (amt < 0) {
      const absAmt = Math.abs(amt)
      if (EXCLUDED_FROM_COSTS.has(cat)) {
        // 자산성/대표자급여 등은 비용에서 제외
        continue
      }
      if (businessSet.has(cat)) {
        s.businessCosts[cat] = (s.businessCosts[cat] ?? 0) + absAmt
        s.businessCostTotal += absAmt
      } else if (personalSet.has(cat)) {
        s.personalCosts[cat] = (s.personalCosts[cat] ?? 0) + absAmt
        s.personalCostTotal += absAmt
      } else {
        s.otherCosts += absAmt
      }
    }
  }

  s.operatingProfit = s.revenue - s.businessCostTotal
  s.netProfit = s.operatingProfit - s.personalCostTotal
  return s
}

export function computeAllMonthsSummary(txs: Transaction[]): MonthlySummary[] {
  // 거래 데이터에서 등장한 모든 yearMonth 추출
  const months = new Set<string>()
  for (const tx of txs) months.add(tx.date.slice(0, 7))
  return [...months].sort().map(m => computeMonthlySummary(txs, m))
}
