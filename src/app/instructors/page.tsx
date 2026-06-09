import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { fetchAllPasses } from '@/lib/supabase/passes'
import { fetchPayrollByMonth } from '@/lib/supabase/payroll'
import { fetchAllRates } from '@/lib/supabase/member-instructor-rates'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { InstructorsTabs } from './InstructorsTabs'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { groupPassesByMember } from '@/lib/analytics/instructor-kpi'
import { computeInstructorScorecards, computeGroupClosureStats, type InstructorScorecardRow, type IncentiveSetting } from '@/lib/analytics/instructor-scorecard'
import { fetchGroupSessionsForAnalytics } from '@/lib/supabase/group-sessions'
import { resolvePeriod, isPeriodKey, type PeriodKey } from '@/lib/analytics/period'

export const dynamic = 'force-dynamic'

type Tab = 'list' | 'payroll' | 'scorecard'

export default async function InstructorsPage({ searchParams }: { searchParams: Promise<{ tab?: string; ym?: string; period?: string }> }) {
  await import('@/lib/supabase/guard').then(m => m.guardManagerPage())
  const params = await searchParams
  const tab: Tab = params.tab === 'payroll' ? 'payroll' : params.tab === 'scorecard' ? 'scorecard' : 'list'
  const yearMonth = params.ym || new Date().toISOString().slice(0, 7)
  const periodKey: PeriodKey = isPeriodKey(params.period) ? params.period : 'month'

  let instructors: Awaited<ReturnType<typeof fetchAllInstructors>> = []
  let payrollRecords: Awaited<ReturnType<typeof fetchPayrollByMonth>> = []
  const memberCounts: Record<number, number> = {}
  const revenueByInstructor: Record<number, number> = {}
  let scorecards: InstructorScorecardRow[] = []
  const ownerId = await requireOwnerId().catch(() => 'no-auth')

  if (hasSupabaseConfig()) {
    instructors = await fetchAllInstructors(ownerId)
    if (tab === 'list') {
      // 강사별 회원수 + 매출을 passes 한 번 조회로 집계 (이전엔 강사 N명당 N+1 쿼리).
      try {
        const allPasses = await fetchAllPasses(ownerId)
        const memberSets: Record<number, Set<number>> = {}
        for (const p of allPasses) {
          if (p.instructorId == null) continue
          revenueByInstructor[p.instructorId] = (revenueByInstructor[p.instructorId] ?? 0) + (p.paymentAmount ?? 0)
          // 회원수 = 이용중 수강권 보유 unique 회원 (countMembersByInstructor와 동일 기준)
          if (p.status === '이용중' && p.memberId != null) {
            (memberSets[p.instructorId] ??= new Set<number>()).add(p.memberId)
          }
        }
        for (const inst of instructors) {
          memberCounts[inst.id] = memberSets[inst.id]?.size ?? 0
        }
      } catch {/* fallback: 카운트·매출 0 유지 */}
    } else if (tab === 'scorecard') {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const [allPasses, rates, groupSessions] = await Promise.all([
          fetchAllPasses(ownerId),
          fetchAllRates(ownerId),
          fetchGroupSessionsForAnalytics(ownerId),
        ])
        const allByMember = groupPassesByMember(allPasses)
        const ratesByInstructor = new Map<number, IncentiveSetting[]>()
        for (const r of rates) {
          const arr = ratesByInstructor.get(r.instructorId) ?? []
          arr.push({ incentivePerSession: r.incentivePerSession })
          ratesByInstructor.set(r.instructorId, arr)
        }
        const period = resolvePeriod(periodKey, today)
        const closureByInstructor = computeGroupClosureStats(groupSessions, period)
        scorecards = computeInstructorScorecards(instructors, allPasses, allByMember, period, ratesByInstructor, closureByInstructor)
      } catch {/* fallback: 빈 scorecards */}
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
        scorecards={scorecards}
        periodKey={periodKey}
      />
    </div>
  )
}
