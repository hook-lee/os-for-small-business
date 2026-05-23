import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { fetchPayrollByMonth } from '@/lib/supabase/payroll'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { PayrollTable } from './PayrollTable'

export const dynamic = 'force-dynamic'

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  const params = await searchParams
  const yearMonth = params.ym || new Date().toISOString().slice(0, 7)

  const instructors = hasSupabaseConfig() ? await fetchAllInstructors() : []
  const records = hasSupabaseConfig() ? await fetchPayrollByMonth(yearMonth) : []

  return (
    <div className="space-y-4">
      <PayrollTable
        initialMonth={yearMonth}
        instructors={instructors}
        initialRecords={records}
      />
    </div>
  )
}
