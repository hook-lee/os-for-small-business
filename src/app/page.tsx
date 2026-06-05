import { fetchAllMembers } from '@/lib/supabase/members'
import { fetchAllPasses, type Pass } from '@/lib/supabase/passes'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { fetchLessonsByDate } from '@/lib/supabase/lessons'
import { fetchPayrollByMonth } from '@/lib/supabase/payroll'
import { loadTransactions } from '@/lib/data/loader'
import { loadProfile } from '@/lib/profile/settings'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { findExpiringMembers, findDormantMembers, findLowRemainingMembers } from '@/lib/analytics/member-segments'
import { computePassesKPI, filterPassesByRange } from '@/lib/analytics/sales-report'
import { simulateAnnualVAT } from '@/lib/tax/vat'
import { recommendReserve } from '@/lib/tax/reserve'
import { getUpcomingDueDates } from '@/lib/tax/due-dates'
import { getActionCards } from '@/lib/advice/action-cards'
import { computeOverallTrialConversion, groupPassesByMember } from '@/lib/analytics/instructor-kpi'
import { computeAnnualKPIs } from '@/lib/analytics/annual-kpi'
import { Card } from '@/components/ui/Card'
import { GoalSummaryCard } from '@/components/Goals/KpiDashboard'
import { DueDateBanner } from '@/components/HomeCards/DueDateBanner'
import { VATForecastCard } from '@/components/HomeCards/VATForecastCard'
import { ReserveCard } from '@/components/HomeCards/ReserveCard'
import { ActionCardsList } from '@/components/HomeCards/ActionCardsList'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export default async function HomePage() {
  const today = new Date().toISOString().slice(0, 10)
  const year = parseInt(today.slice(0, 4), 10)
  const month = parseInt(today.slice(5, 7), 10)
  const yearMonth = today.slice(0, 7)
  const monthStart = `${yearMonth}-01`
  const monthEndDay = new Date(year, month, 0).getDate()
  const monthEnd = `${yearMonth}-${String(monthEndDay).padStart(2, '0')}`

  // Fetch all in parallel; fallback to empty/null
  let transactions: Awaited<ReturnType<typeof loadTransactions>> = []
  let members: Awaited<ReturnType<typeof fetchAllMembers>> = []
  let passes: Pass[] = []
  let instructors: Awaited<ReturnType<typeof fetchAllInstructors>> = []
  let todayLessons: Awaited<ReturnType<typeof fetchLessonsByDate>> = []
  let payrollRecords: Awaited<ReturnType<typeof fetchPayrollByMonth>> = []

  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  try {
    transactions = await loadTransactions(ownerId)
  } catch {}

  if (hasSupabaseConfig()) {
    try {
      ;[members, passes, instructors, todayLessons, payrollRecords] = await Promise.all([
        fetchAllMembers(ownerId),
        fetchAllPasses(ownerId),
        fetchAllInstructors(ownerId),
        fetchLessonsByDate(today, ownerId),
        fetchPayrollByMonth(yearMonth, ownerId),
      ])
    } catch {}
  }

  const profile = await loadProfile(ownerId).catch(() => null)

  // 연간 KPI (활성 회원 등) — 올해 목표 대시보드와 동일 소스로 계산해 페이지 내 숫자 일치 보장
  const annualKpis = computeAnnualKPIs(year, today, { transactions, members, passes })
  const annualGoal = profile?.annualGoals?.[String(year)] ?? null
  const activeMemberCount = annualKpis.activeMembers

  const expiring = findExpiringMembers(members, passes, today, 7)
  const dormant = findDormantMembers(members, today, 60)
  const lowRemainingThreshold = profile?.lowRemainingThreshold ?? 3
  const lowRemaining = findLowRemainingMembers(members, passes, today, lowRemainingThreshold)

  const passesThisMonth = filterPassesByRange(passes, monthStart, monthEnd)
  const monthlySalesKPI = computePassesKPI(passesThisMonth)

  // 미정산 강사
  const paidInstructorIds = new Set(payrollRecords.filter(r => r.paid).map(r => r.instructorId))
  const unpaidInstructors = instructors.filter(i => i.role !== 'owner' && !paidInstructorIds.has(i.id))

  // Tax data — 부가세는 연 단위 단일 소스(simulateAnnualVAT). 분기 함수 직접 노출 X.
  const taxPayerType = profile?.taxPayerType ?? 'general'
  const vatResult = simulateAnnualVAT(transactions, year, today, { taxPayerType })
  const reserveResult = recommendReserve(transactions, today, {
    personalDeductionCount: profile?.personalDeductionCount ?? 1,
    noranusanContribution: profile?.noranusanAnnualContribution ?? 0,
    pensionSavings: profile?.pensionAnnualContribution ?? 0,
    youngStartupReduction: (profile?.isYoungStartupEligible ? profile.youngStartupReductionRate : 0),
    taxPayerType,
  })
  const dueDates = getUpcomingDueDates(today, taxPayerType)
  const nextDue = dueDates[0]
  const actionCards = getActionCards(transactions, today, {
    noranusanContribution: profile?.noranusanAnnualContribution ?? 0,
    isYoungStartupSet: profile?.isYoungStartupEligible ?? false,
    recommendedMonthlyReserve: reserveResult.monthly,
    incomeTaxEstimate: reserveResult.breakdown.incomeTaxTotal,
    taxPayerType,
  }).filter(c => c.triggered)
  const byMember = groupPassesByMember(passes)
  const conversion = computeOverallTrialConversion(byMember)

  return (
    <div className="space-y-4">
      {nextDue && <DueDateBanner due={nextDue} />}

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HeroKpi
          label="오늘 수업"
          value={`${todayLessons.length}건`}
          link={{ href: '/lessons', text: '수업 →' }}
          accent="blue"
        />
        <HeroKpi
          label="활성 회원"
          value={`${activeMemberCount}명`}
          link={{ href: '/members', text: '회원 →' }}
          accent="green"
        />
        <HeroKpi
          label={`이번달 매출 (${month}월)`}
          value={`${monthlySalesKPI.total.toLocaleString()}원`}
          link={{ href: '/sales', text: '매출 →' }}
          accent="purple"
        />
        <HeroKpi
          label={nextDue ? `다음 ${nextDue.label.includes('부가세') ? '부가세' : '종소세'}` : '납부일'}
          value={nextDue ? `D-${nextDue.daysRemaining}` : '—'}
          link={{ href: '/tax', text: '세금 →' }}
          accent="amber"
        />
      </div>

      {/* 알림 / 액션 필요 */}
      {(expiring.length > 0 || dormant.length > 0 || unpaidInstructors.length > 0 || lowRemaining.length > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="text-sm font-semibold text-amber-900 mb-2">⚠️ 처리 필요</div>
          <div className="space-y-1.5">
            {lowRemaining.length > 0 && (
              <a href="/members?filter=low" className="block text-sm hover:underline">
                <span className="text-orange-700 font-medium">잔여 {lowRemainingThreshold}회 이하 {lowRemaining.length}명</span>
                <span className="text-neutral-500 text-xs ml-2">재등록 안내 필요 (설정에서 기준 변경)</span>
              </a>
            )}
            {expiring.length > 0 && (
              <a href="/members?filter=expiring" className="block text-sm hover:underline">
                <span className="text-amber-700 font-medium">만료 임박 {expiring.length}명</span>
                <span className="text-neutral-500 text-xs ml-2">7일 내 수강권 만료</span>
              </a>
            )}
            {dormant.length > 0 && (
              <a href="/members?filter=dormant" className="block text-sm hover:underline">
                <span className="text-red-700 font-medium">휴면 회원 {dormant.length}명</span>
                <span className="text-neutral-500 text-xs ml-2">60일+ 미출석</span>
              </a>
            )}
            {unpaidInstructors.length > 0 && (
              <a href={`/instructors?tab=payroll&ym=${yearMonth}`} className="block text-sm hover:underline">
                <span className="text-blue-700 font-medium">미정산 강사 {unpaidInstructors.length}명</span>
                <span className="text-neutral-500 text-xs ml-2">{yearMonth} 이번달 미지급</span>
              </a>
            )}
          </div>
        </Card>
      )}

      {/* 올해 목표 달성 현황 */}
      <GoalSummaryCard kpis={annualKpis} goal={annualGoal} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 오늘 일정 */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">오늘 일정</h3>
            <a href="/lessons" className="text-xs text-blue-600 hover:underline">전체 보기 →</a>
          </div>
          {todayLessons.length === 0 ? (
            <p className="text-sm text-neutral-400">오늘 등록된 수업이 없습니다.</p>
          ) : (
            <div className="space-y-1.5">
              {todayLessons.slice(0, 5).map(l => (
                <div key={l.id} className="flex items-center gap-3 text-sm">
                  <span className="font-medium tabular-nums w-12 text-neutral-600">{l.lessonTime ?? '—'}</span>
                  <a href={`/members/${l.memberId}`} className="hover:underline text-blue-600">{l.memberName}</a>
                  <span className="text-xs text-neutral-500">{l.instructorName ?? '강사 미정'} · {l.passName ?? '—'}</span>
                </div>
              ))}
              {todayLessons.length > 5 && (
                <div className="text-xs text-neutral-400 mt-2">외 {todayLessons.length - 5}건</div>
              )}
            </div>
          )}
        </Card>

        {/* 부가세 + 예비비 */}
        <div className="space-y-3">
          <VATForecastCard result={vatResult} />
          <ReserveCard recommendation={reserveResult} />
        </div>
      </div>

      {/* 절세 액션 */}
      {actionCards.length > 0 && <ActionCardsList cards={actionCards} />}

      {/* 전환율 */}
      <Card>
        <div className="text-xs text-neutral-500">전체 전환율 (체험 → 정회원)</div>
        <div className="text-2xl font-bold mt-1">{(conversion.rate * 100).toFixed(0)}%</div>
        <div className="text-xs text-neutral-400 mt-1">체험 {conversion.trialCount}명 → {conversion.convertedCount}명</div>
      </Card>
    </div>
  )
}

function HeroKpi({ label, value, link, accent }: {
  label: string
  value: string
  link: { href: string; text: string }
  accent: 'blue' | 'green' | 'purple' | 'amber'
}) {
  const accentClass = {
    blue: 'border-l-blue-500',
    green: 'border-l-green-500',
    purple: 'border-l-purple-500',
    amber: 'border-l-amber-500',
  }[accent]
  return (
    <a href={link.href} className="block">
      <Card className={`border-l-4 ${accentClass} hover:shadow-md transition-shadow`}>
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="text-base sm:text-xl font-bold mt-1 tabular-nums break-keep">{value}</div>
        <div className="text-xs text-blue-600 mt-1">{link.text}</div>
      </Card>
    </a>
  )
}
