import { Card } from '@/components/ui/Card'
import type { AnnualKPIs } from '@/lib/analytics/annual-kpi'
import { achievementRate } from '@/lib/analytics/annual-kpi'
import type { AnnualGoal } from '@/lib/profile/settings'

function won(n: number): string {
  return `${Math.round(n).toLocaleString()}원`
}
function count(n: number): string {
  return `${n.toLocaleString()}명`
}
function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

interface MetricDef {
  key: keyof AnnualGoal
  label: string
  actual: number
  goal: number | null
  fmt: (n: number) => string
  sub?: string
}

function buildMetrics(kpis: AnnualKPIs, goal: AnnualGoal | null): MetricDef[] {
  const g = goal ?? null
  return [
    { key: 'revenue', label: '연 매출', actual: kpis.revenue, goal: g?.revenue ?? null, fmt: won },
    { key: 'netProfit', label: '순이익', actual: kpis.netProfit, goal: g?.netProfit ?? null, fmt: won },
    { key: 'activeMembers', label: '활성 회원', actual: kpis.activeMembers, goal: g?.activeMembers ?? null, fmt: count },
    { key: 'newMembers', label: '신규 회원 (올해)', actual: kpis.newMembers, goal: g?.newMembers ?? null, fmt: count },
    {
      key: 'trialConversionRate', label: '체험→등록 전환율',
      actual: kpis.trialConversionRate, goal: g?.trialConversionRate ?? null, fmt: pct,
      sub: `체험 ${kpis.trialDetail.trialCount}명 → ${kpis.trialDetail.convertedCount}명`,
    },
    {
      key: 'reregistrationRate', label: '재등록률',
      actual: kpis.reregistrationRate, goal: g?.reregistrationRate ?? null, fmt: pct,
      sub: `결제 ${kpis.reregistrationDetail.payingMembers}명 중 ${kpis.reregistrationDetail.repeatMembers}명 재등록`,
    },
  ]
}

function barColor(rate: number | null): string {
  if (rate === null) return 'bg-neutral-300'
  if (rate >= 1) return 'bg-green-500'
  if (rate >= 0.5) return 'bg-blue-500'
  return 'bg-amber-400'
}

function MetricRow({ m }: { m: MetricDef }) {
  const rate = achievementRate(m.actual, m.goal)
  const widthPct = rate === null ? 0 : Math.max(0, Math.min(rate, 1)) * 100
  return (
    <div className="py-2.5">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-2">
        <div className="text-sm font-medium text-neutral-700 shrink-0">{m.label}</div>
        <div className="text-sm tabular-nums break-keep sm:text-right">
          <span className="font-bold">{m.fmt(m.actual)}</span>
          {m.goal != null
            ? <span className="text-neutral-400"> / {m.fmt(m.goal)}</span>
            : <span className="text-neutral-300"> / 목표 미설정</span>}
        </div>
      </div>
      <div className="mt-1.5 h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor(rate)} transition-all`} style={{ width: `${widthPct}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[11px] text-neutral-400">{m.sub ?? ''}</span>
        {rate !== null && (
          <span className={`text-[11px] font-semibold tabular-nums ${rate >= 1 ? 'text-green-600' : 'text-neutral-500'}`}>
            달성률 {(rate * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * 연간 KPI 대시보드 (목표 대비 실적). 순수 렌더 — 서버/클라 어디서나.
 * compact=true: 홈용 — 금액형 3개만(매출·순이익·활성회원).
 */
export function KpiDashboard({
  kpis,
  goal,
  compact = false,
}: {
  kpis: AnnualKPIs
  goal: AnnualGoal | null
  compact?: boolean
}) {
  const all = buildMetrics(kpis, goal)
  const metrics = compact ? all.filter(m => m.key === 'revenue' || m.key === 'netProfit' || m.key === 'activeMembers') : all

  return (
    <div className="divide-y divide-neutral-100">
      {metrics.map(m => <MetricRow key={m.key} m={m} />)}
    </div>
  )
}

/** 홈용 컴팩트 카드 — 매출 달성률 위주 + /goals 링크 */
export function GoalSummaryCard({ kpis, goal }: { kpis: AnnualKPIs; goal: AnnualGoal | null }) {
  const hasAnyGoal = goal != null && Object.values(goal).some(v => v != null && v > 0)
  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">🎯 올해 목표 ({kpis.year})</h3>
        <a href="/goals" className="text-xs text-blue-600 hover:underline">
          {hasAnyGoal ? '대시보드 →' : '목표 설정 →'}
        </a>
      </div>
      {hasAnyGoal ? (
        <KpiDashboard kpis={kpis} goal={goal} compact />
      ) : (
        <p className="text-sm text-neutral-400 py-2">
          올해 매출·회원 목표를 설정하면 달성률을 여기서 추적할 수 있어요.
        </p>
      )}
    </Card>
  )
}
