/**
 * 월별 요약 — Excel 우측 패널 형태로 구성.
 *
 * 좌측 (사업): 매출 + 사업 비용 → 영업이익
 * 우측 (개인): 개인 비용 → 순수익
 * 결제수단별 매출: 카드 / 계좌이체 / 현금
 *
 * ⚠️ 카테고리는 하드코딩하지 않는다.
 * 각 거래의 `classification`(business/living/owner_draw/reserve/capital)으로 분류하고,
 * 패널에 표시할 카테고리는 그 원장이 실제로 사용한 카테고리에서 자동 생성한다.
 * (특정 센터 전용 항목을 미리 박아두지 않음 — 원장이 설계하기 나름.)
 */
import type { Transaction } from '@/types/domain'

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
  businessCosts: Record<string, number>   // category → amount (always positive). classification==='business'
  businessCostTotal: number
  operatingProfit: number                  // 매출 - 사업 비용
  personalCosts: Record<string, number>    // classification==='living'
  personalCostTotal: number
  netProfit: number                         // 영업이익 - 개인 비용
  ownerDraw: number                         // 대표 인출 (owner_draw) — 비용 X, 별도 표기
  reserve: number                           // 세금 적립 (reserve) — 비용 X, 별도 표기
  otherCosts: number                        // 자산성 지출 (capital) — 비용 합계 제외
  transactionCount: number
}

function emptySummary(yearMonth: string): MonthlySummary {
  return {
    yearMonth,
    revenue: 0,
    revenueByMethod: { card: 0, transfer: 0, cash: 0, other: 0 },
    revenueCountByMethod: { card: 0, transfer: 0, cash: 0, other: 0 },
    businessCosts: {},
    businessCostTotal: 0,
    operatingProfit: 0,
    personalCosts: {},
    personalCostTotal: 0,
    netProfit: 0,
    ownerDraw: 0,
    reserve: 0,
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

  for (const tx of txs) {
    if (!tx.date.startsWith(yearMonth)) continue
    s.transactionCount++

    const cat = getCategory(tx)
    const amt = tx.amount

    if (amt > 0) {
      // 매출 — '매출' 카테고리만 진짜 매출로 (다른 양수는 환불/조정성이라 제외)
      if (cat === '매출') {
        s.revenue += amt
        const k = methodKey(tx.method)
        s.revenueByMethod[k] += amt
        s.revenueCountByMethod[k]++
      }
      continue
    }

    if (amt < 0) {
      const absAmt = Math.abs(amt)
      // 분류 기준은 카테고리 이름이 아니라 거래의 classification (원장이 설계한 값).
      switch (tx.classification) {
        case 'business':
          s.businessCosts[cat] = (s.businessCosts[cat] ?? 0) + absAmt
          s.businessCostTotal += absAmt
          break
        case 'living':
          s.personalCosts[cat] = (s.personalCosts[cat] ?? 0) + absAmt
          s.personalCostTotal += absAmt
          break
        case 'owner_draw':
          s.ownerDraw += absAmt        // 사업소득 차감 X
          break
        case 'reserve':
          s.reserve += absAmt          // 세금 적립 — 비용 X
          break
        case 'capital':
          s.otherCosts += absAmt       // 자산성 — 비용 합계 제외 (감가상각 대상)
          break
        default:
          // classification이 비어있는 예외 데이터 — 개인 비용으로 안전 분류
          s.personalCosts[cat] = (s.personalCosts[cat] ?? 0) + absAmt
          s.personalCostTotal += absAmt
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

/**
 * 여러 월 요약에서 사업/개인 비용에 등장한 카테고리 목록을 합집합으로 추출.
 * 금액 합계 내림차순 정렬 → 큰 비용이 위로. (월마다 행이 바뀌지 않게 안정적 표시용)
 */
export function collectCostCategories(
  summaries: MonthlySummary[],
  panel: 'business' | 'personal',
): string[] {
  const totals = new Map<string, number>()
  for (const s of summaries) {
    const costs = panel === 'business' ? s.businessCosts : s.personalCosts
    for (const [cat, amt] of Object.entries(costs)) {
      totals.set(cat, (totals.get(cat) ?? 0) + amt)
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([cat]) => cat)
}
