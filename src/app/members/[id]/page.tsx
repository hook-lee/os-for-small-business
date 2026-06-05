import { fetchMemberById } from '@/lib/supabase/members'
import { fetchPassesByMember } from '@/lib/supabase/passes'
import { fetchLessonsByMember } from '@/lib/supabase/lessons'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { fetchRatesByMember } from '@/lib/supabase/member-instructor-rates'
import { computeMemberLTV, computeAttendanceStats } from '@/lib/analytics/member-stats'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import { IssuePassForm } from './IssuePassForm'
import { PassesList } from './PassesList'
import { MemberMemoEditor } from './MemberMemoEditor'
import { MemberEditor } from './MemberEditor'
import { MemberAccessLink } from './MemberAccessLink'
import { MemberConsultations } from './MemberConsultations'
import { MemberPassEvents } from './MemberPassEvents'
import { MemberInstructorRates } from './MemberInstructorRates'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) notFound()
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id)) notFound()
  const ownerId = await requireOwnerId().catch(() => 'no-auth')

  const today = new Date().toISOString().slice(0, 10)
  const [m, passes, lessons, instructors, memberRates] = await Promise.all([
    fetchMemberById(id, ownerId),
    fetchPassesByMember(id, ownerId),
    fetchLessonsByMember(id, ownerId),
    fetchAllInstructors(ownerId).catch(() => []),
    fetchRatesByMember(id, ownerId).catch(() => []),
  ])
  if (!m) notFound()

  const ltv = computeMemberLTV(passes)
  const attendance = computeAttendanceStats(lessons, today)

  // 담당 강사 = 이 회원의 '이용중' 수강권에 연결된 강사 (없으면 가장 최근 수강권 기준).
  // passes는 paid_at desc 정렬이라 [0]이 최신.
  const instructorMap = new Map(instructors.map(i => [i.id, i]))
  const activeInstructorIds = [...new Set(
    passes.filter(p => p.status === '이용중' && p.instructorId != null).map(p => p.instructorId as number),
  )]
  const fallbackInstructorId = passes.find(p => p.instructorId != null)?.instructorId ?? null
  const assignedInstructorIds = activeInstructorIds.length > 0
    ? activeInstructorIds
    : (fallbackInstructorId != null ? [fallbackInstructorId] : [])
  const assignedInstructors = assignedInstructorIds
    .map(iid => instructorMap.get(iid))
    .filter((i): i is NonNullable<typeof i> => i != null)
  const hasActiveAssignment = activeInstructorIds.length > 0

  return (
    <div className="space-y-4 max-w-2xl">
      <a href="/members" className="text-sm text-neutral-500 hover:underline">← 회원 목록</a>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-semibold">{m.name}</h2>
        <div className="flex items-center gap-2">
          <a
            href={`/messages?member=${m.id}`}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded font-medium"
            title="이 회원에게 메시지 보내기"
          >
            💬 메시지
          </a>
        </div>
      </div>
      <MemberEditor member={m} />

      {/* 담당 강사 — 회원↔강사 싱크 (수강권의 instructor_id 기반) */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-neutral-500 shrink-0">
            담당 강사 {hasActiveAssignment ? '(이용중 기준)' : '(최근 수강권 기준)'}
          </span>
          {assignedInstructors.length === 0 ? (
            <span className="text-sm text-neutral-400">— 연결된 강사 없음 (수강권 발급/수정 시 강사를 지정하세요)</span>
          ) : (
            assignedInstructors.map(inst => (
              <a
                key={inst.id}
                href={`/instructors/${inst.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-full"
              >
                {inst.color && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: inst.color }} />}
                {inst.name}
              </a>
            ))
          )}
        </div>
      </div>

      {assignedInstructors.length > 0 && (
        <MemberInstructorRates
          memberId={m.id}
          instructors={assignedInstructors.map(i => ({
            id: i.id,
            name: i.name,
            color: i.color,
            ratePrivate: i.ratePrivate,
            rateRehab: i.rateRehab,
            rateDuet: i.rateDuet,
            rateGroup: i.rateGroup,
          }))}
          initialRates={memberRates}
        />
      )}

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

      <div className="mt-6">
        <MemberConsultations memberId={m.id} ownerId={ownerId} />
      </div>

      <div className="mt-6">
        <MemberPassEvents memberId={m.id} ownerId={ownerId} />
      </div>
    </div>
  )
}

function KpiBox({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="text-base sm:text-xl font-bold mt-1 tabular-nums break-keep">{value}</div>
      <div className="text-xs text-neutral-400 mt-1">{sub}</div>
    </div>
  )
}
