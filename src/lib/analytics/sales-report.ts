import type { Pass } from '@/lib/supabase/passes'
import type { Transaction } from '@/types/domain'

export interface SalesKPI {
  total: number          // 합계 (모든 매출)
  newPayment: number     // 신규결제 합계
  rePayment: number      // 재결제 합계
  trialPayment: number   // 체험 매출 (pass_name에 '체험' 포함)
  refund: number         // 환불 (negative amount → abs)
  transactionCount: number
}

function isTrialPass(name: string): boolean {
  return name.includes('체험')
}

export function computePassesKPI(passes: Pass[]): SalesKPI {
  let total = 0
  let newPayment = 0
  let rePayment = 0
  let trialPayment = 0
  let refund = 0
  for (const p of passes) {
    const amt = p.paymentAmount ?? 0
    if (amt < 0) {
      refund += Math.abs(amt)
    } else {
      total += amt
      if (p.paymentType === '신규결제') newPayment += amt
      else if (p.paymentType === '재결제') rePayment += amt
      if (isTrialPass(p.passName)) trialPayment += amt
    }
  }
  return { total, newPayment, rePayment, trialPayment, refund, transactionCount: passes.length }
}

export function computeTransactionsKPI(txs: Transaction[]): {
  total: number
  count: number
  expense: number
  expenseCount: number
} {
  let total = 0
  let count = 0
  let expense = 0
  let expenseCount = 0
  for (const t of txs) {
    if (t.category === '매출' && t.amount > 0) {
      total += t.amount
      count++
    } else if (t.amount < 0) {
      expense += Math.abs(t.amount)
      expenseCount++
    }
  }
  return { total, count, expense, expenseCount }
}

/**
 * 상품별 매출 (passes 기준)
 */
export function revenueByProduct(passes: Pass[]): Array<{ name: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>()
  for (const p of passes) {
    if ((p.paymentAmount ?? 0) <= 0) continue
    const key = p.passName
    const cur = map.get(key) ?? { total: 0, count: 0 }
    cur.total += p.paymentAmount ?? 0
    cur.count++
    map.set(key, cur)
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
}

/**
 * 강사별 매출 (passes 기준)
 */
export function revenueByInstructor(passes: Pass[], instructorIdToName: Map<number, string>): Array<{ instructorId: number; name: string; total: number; count: number }> {
  const map = new Map<number, { total: number; count: number }>()
  for (const p of passes) {
    if (p.instructorId == null) continue
    if ((p.paymentAmount ?? 0) <= 0) continue
    const cur = map.get(p.instructorId) ?? { total: 0, count: 0 }
    cur.total += p.paymentAmount ?? 0
    cur.count++
    map.set(p.instructorId, cur)
  }
  return Array.from(map.entries())
    .map(([id, v]) => ({ instructorId: id, name: instructorIdToName.get(id) ?? `강사#${id}`, ...v }))
    .sort((a, b) => b.total - a.total)
}

/**
 * 결제수단별 매출 (passes 기준)
 */
export function revenueByMethod(passes: Pass[]): Array<{ method: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>()
  for (const p of passes) {
    if ((p.paymentAmount ?? 0) <= 0) continue
    const method = p.paymentMethod ?? '미상'
    const cur = map.get(method) ?? { total: 0, count: 0 }
    cur.total += p.paymentAmount ?? 0
    cur.count++
    map.set(method, cur)
  }
  return Array.from(map.entries())
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.total - a.total)
}

/**
 * 월별 매출 (passes 기준, paid_at 기준)
 */
export function revenueByMonth(passes: Pass[]): Array<{ month: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>()
  for (const p of passes) {
    if (!p.paidAt) continue
    if ((p.paymentAmount ?? 0) <= 0) continue
    const month = p.paidAt.slice(0, 7)
    const cur = map.get(month) ?? { total: 0, count: 0 }
    cur.total += p.paymentAmount ?? 0
    cur.count++
    map.set(month, cur)
  }
  return Array.from(map.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * 기간 필터링 (paid_at 기준)
 */
export function filterPassesByRange(passes: Pass[], start: string, end: string): Pass[] {
  return passes.filter(p => {
    if (!p.paidAt) return false
    return p.paidAt >= start && p.paidAt <= end
  })
}

export function filterTransactionsByRange(txs: Transaction[], start: string, end: string): Transaction[] {
  return txs.filter(t => t.date >= start && t.date <= end)
}
