import { fetchAllPasses } from '@/lib/supabase/passes'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { loadTransactions } from '@/lib/data/loader'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { SalesReport } from './SalesReport'
import { FinancesTabBar } from '@/components/FinancesTabBar'

export const dynamic = 'force-dynamic'

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  const params = await searchParams
  const yearMonth = params.ym || new Date().toISOString().slice(0, 7)

  let passes: Awaited<ReturnType<typeof fetchAllPasses>> = []
  let instructors: Awaited<ReturnType<typeof fetchAllInstructors>> = []
  let transactions: Awaited<ReturnType<typeof loadTransactions>> = []

  if (hasSupabaseConfig()) {
    try {
      ;[passes, instructors, transactions] = await Promise.all([
        fetchAllPasses(),
        fetchAllInstructors(),
        loadTransactions(),
      ])
    } catch {
      // fallback to empty
    }
  }

  return (
    <>
      <FinancesTabBar />
      <SalesReport
        initialMonth={yearMonth}
        passes={passes}
        instructors={instructors}
        transactions={transactions}
      />
    </>
  )
}
