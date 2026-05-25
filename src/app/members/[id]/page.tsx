import { fetchMemberById } from '@/lib/supabase/members'
import { fetchPassesByMember } from '@/lib/supabase/passes'
import { fetchLessonsByMember } from '@/lib/supabase/lessons'
import { computeMemberLTV, computeAttendanceStats } from '@/lib/analytics/member-stats'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import { IssuePassForm } from './IssuePassForm'
import { PassesList } from './PassesList'
import { MemberMemoEditor } from './MemberMemoEditor'
import { MemberEditor } from './MemberEditor'
import { MemberAccessLink } from './MemberAccessLink'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) notFound()
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id)) notFound()
  const ownerId = await requireOwnerId().catch(() => 'no-auth')

  const today = new Date().toISOString().slice(0, 10)
  const [m, passes, lessons] = await Promise.all([
    fetchMemberById(id, ownerId),
    fetchPassesByMember(id, ownerId),
    fetchLessonsByMember(id, ownerId),
  ])
  if (!m) notFound()

  const ltv = computeMemberLTV(passes)
  const attendance = computeAttendanceStats(lessons, today)

  return (
    <div className="space-y-4 max-w-2xl">
      <a href="/members" className="text-sm text-neutral-500 hover:underline">← 회원 목록</a>
      <h2 className="text-2xl font-semibold">{m.name}</h2>
      <MemberEditor member={m} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <KpiBox title="총 결제액" value={`${ltv.totalPaid.toLocaleString()}원`} sub={`${ltv.passCount}건`} />
        <KpiBox title="평균 결제" value={`${ltv.averagePaymentAmount.toLocaleString()}원`} sub="" />
        <KpiBox title="최근 30일 출석" value={`${attendance.last30}회`} sub={`60일 ${attendance.last60} / 90일 ${attendance.last90}`} />
        <KpiBox title="평균 출석 간격" value={attendance.averageDaysBetween ? `${attendance.averageDaysBetween}일` : '—'} sub={`총 ${attendance.totalCompleted}회 완료`} />
      </div>

      <MemberMemoEditor memberId={m.id} initialInternalMemo={m.internalMemo} />

      <MemberAccessLink memberId={m.id} initialToken={m.accessToken ?? null} />

      <div>
        <div className="flex items-center justify-between mt-6 mb-2">
          <h3 className="text-lg font-semibold">수강권 이력 ({passes.length}건)</h3>
          <IssuePassForm memberId={m.id} />
        </div>
        <PassesList initial={passes} />
      </div>
    </div>
  )
}

function KpiBox({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-neutral-400 mt-1">{sub}</div>
    </div>
  )
}
