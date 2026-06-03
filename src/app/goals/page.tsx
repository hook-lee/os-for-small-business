import { fetchAllMembers } from '@/lib/supabase/members'
import { fetchAllPasses, type Pass } from '@/lib/supabase/passes'
import { loadTransactions } from '@/lib/data/loader'
import { loadProfile } from '@/lib/profile/settings'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { computeAnnualKPIs } from '@/lib/analytics/annual-kpi'
import { Card } from '@/components/ui/Card'
import { KpiDashboard } from '@/components/Goals/KpiDashboard'
import { GoalsForm } from './GoalsForm'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export default async function GoalsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const year = parseInt(today.slice(0, 4), 10)

  let transactions: Awaited<ReturnType<typeof loadTransactions>> = []
  let members: Awaited<ReturnType<typeof fetchAllMembers>> = []
  let passes: Pass[] = []

  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  try {
    transactions = await loadTransactions(ownerId)
  } catch {}
  if (hasSupabaseConfig()) {
    try {
      ;[members, passes] = await Promise.all([
        fetchAllMembers(ownerId),
        fetchAllPasses(ownerId),
      ])
    } catch {}
  }
  const profile = await loadProfile(ownerId).catch(() => null)

  const kpis = computeAnnualKPIs(year, today, { transactions, members, passes })
  const allGoals = profile?.annualGoals ?? {}
  const goal = allGoals[String(year)] ?? null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">🎯 {year}년 목표 대시보드</h1>
        <p className="text-sm text-neutral-500 mt-1">
          올해 목표를 설정하고 실적 대비 달성률을 추적하세요. 매출·회원·전환 지표는 실제 데이터에서 자동 계산됩니다.
        </p>
      </div>

      {/* 달성 현황 */}
      <Card>
        <h2 className="text-sm font-semibold mb-1">달성 현황</h2>
        <KpiDashboard kpis={kpis} goal={goal} />
      </Card>

      {/* 목표 설정 */}
      <Card>
        <h2 className="text-sm font-semibold mb-3">{year}년 목표 설정</h2>
        <GoalsForm year={year} initialGoal={goal} allGoals={allGoals} />
      </Card>

      <p className="text-[11px] text-neutral-400">
        ※ 활성 회원·전환율·재등록률은 현재까지 누적 기준, 연 매출·순이익·신규 회원은 {year}년 범위 기준입니다.
      </p>
    </div>
  )
}
