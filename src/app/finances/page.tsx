import { loadTransactions } from '@/lib/data/loader'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { computeAllMonthsSummary } from '@/lib/analytics/monthly-summary'
import { FinancesTabBar } from '@/components/FinancesTabBar'
import { MonthlyDashboard } from './MonthlyDashboard'

export const dynamic = 'force-dynamic'

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  const txs = await loadTransactions(ownerId)
  const allSummaries = computeAllMonthsSummary(txs)

  const sp = await searchParams
  const defaultMonth = allSummaries.length > 0
    ? allSummaries[allSummaries.length - 1].yearMonth
    : new Date().toISOString().slice(0, 7)
  const selectedMonth = sp.ym ?? defaultMonth

  return (
    <div className="space-y-4">
      <FinancesTabBar />
      <MonthlyDashboard allSummaries={allSummaries} initialMonth={selectedMonth} />
    </div>
  )
}
