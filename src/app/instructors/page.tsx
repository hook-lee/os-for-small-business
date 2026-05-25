import { fetchAllInstructors, countMembersByInstructor } from '@/lib/supabase/instructors'
import { fetchAllPasses } from '@/lib/supabase/passes'
import { fetchPayrollByMonth } from '@/lib/supabase/payroll'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { InstructorsTabs } from './InstructorsTabs'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function InstructorsPage({ searchParams }: { searchParams: Promise<{ tab?: string; ym?: string }> }) {
  const params = await searchParams
  const tab = params.tab === 'payroll' ? 'payroll' : 'list'
  const yearMonth = params.ym || new Date().toISOString().slice(0, 7)

  let instructors: Awaited<ReturnType<typeof fetchAllInstructors>> = []
  let payrollRecords: Awaited<ReturnType<typeof fetchPayrollByMonth>> = []
  const memberCounts: Record<number, number> = {}
  const revenueByInstructor: Record<number, number> = {}
  const ownerId = await requireOwnerId().catch(() => 'no-auth')

  if (hasSupabaseConfig()) {
    instructors = await fetchAllInstructors(ownerId)
    if (tab === 'list') {
      await Promise.all(instructors.map(async i => {
        memberCounts[i.id] = await countMembersByInstructor(i.id, ownerId)
      }))
      try {
        const allPasses = await fetchAllPasses(ownerId)
        for (const p of allPasses) {
          if (p.instructorId == null) continue
          revenueByInstructor[p.instructorId] = (revenueByInstructor[p.instructorId] ?? 0) + (p.paymentAmount ?? 0)
        }
      } catch {/* fallback */}
    } else {
      payrollRecords = await fetchPayrollByMonth(yearMonth, ownerId)
    }
  }

  return (
    <div className="space-y-4">
      {!hasSupabaseConfig() && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
          Supabase 미설정 — 환경변수 설정 후 강사 데이터가 표시됩니다.
        </div>
      )}
      <InstructorsTabs
        tab={tab}
        instructors={instructors}
        memberCounts={memberCounts}
        revenueByInstructor={revenueByInstructor}
        payrollMonth={yearMonth}
        payrollRecords={payrollRecords}
      />
    </div>
  )
}
