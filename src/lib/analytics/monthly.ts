import type { Transaction } from '@/types/domain'

export interface MonthlySummary {
  month: string
  revenue: number
  expense: number          // 사업비 + 생활비 + 자본 (= 운영자의 "지출"과 동일, owner_draw/reserve 제외)
  businessExpense: number  // 사업비만 (세금 시뮬용 정의)
  net: number              // revenue - expense (운영자 시야와 동일)
  ownerDraw: number
  reserve: number
}

export function aggregateMonthly(transactions: Transaction[]): MonthlySummary[] {
  const buckets = new Map<string, MonthlySummary>()
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7)
    const b = buckets.get(month) ?? {
      month, revenue: 0, expense: 0, businessExpense: 0, net: 0, ownerDraw: 0, reserve: 0,
    }
    if (tx.amount > 0 && tx.category === '매출') {
      b.revenue += tx.amount
    } else if (tx.amount < 0) {
      const abs = Math.abs(tx.amount)
      if (tx.classification === 'owner_draw') b.ownerDraw += abs
      else if (tx.classification === 'reserve') b.reserve += abs
      else {
        // business + living + capital = Looker 대시보드의 "지출"
        b.expense += abs
        if (tx.classification === 'business') b.businessExpense += abs
      }
    }
    buckets.set(month, b)
  }
  return Array.from(buckets.values())
    .map(b => ({ ...b, net: b.revenue - b.expense }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
