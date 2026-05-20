import type { Transaction } from '@/types/domain'

export interface MonthlySummary {
  month: string
  revenue: number
  expense: number       // owner_draw, reserve, capital 제외한 순수 사업비용
  net: number
  ownerDraw: number     // 별도
  reserve: number       // 별도
}

export function aggregateMonthly(transactions: Transaction[]): MonthlySummary[] {
  const buckets = new Map<string, MonthlySummary>()
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7)
    const b = buckets.get(month) ?? { month, revenue: 0, expense: 0, net: 0, ownerDraw: 0, reserve: 0 }
    if (tx.amount > 0 && tx.category === '매출') b.revenue += tx.amount
    else if (tx.amount < 0) {
      if (tx.classification === 'owner_draw') b.ownerDraw += Math.abs(tx.amount)
      else if (tx.classification === 'reserve') b.reserve += Math.abs(tx.amount)
      else if (tx.classification === 'business' || tx.classification === 'capital') b.expense += Math.abs(tx.amount)
      // living은 사업 KPI에서 제외 (생활비)
    }
    buckets.set(month, b)
  }
  return Array.from(buckets.values())
    .map(b => ({ ...b, net: b.revenue - b.expense }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
