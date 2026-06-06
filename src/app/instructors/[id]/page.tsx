import { fetchInstructorById, fetchMembersByInstructor } from '@/lib/supabase/instructors'
import { fetchAllPasses } from '@/lib/supabase/passes'
import { fetchAllRates } from '@/lib/supabase/member-instructor-rates'
import { computeInstructorKPI, groupPassesByMember } from '@/lib/analytics/instructor-kpi'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { notFound } from 'next/navigation'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { MemberIncentiveInput } from './MemberIncentiveInput'
import { InstructorAccountSection } from './InstructorAccountSection'

export const dynamic = 'force-dynamic'

export default async function InstructorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await import('@/lib/supabase/guard').then(m => m.guardManagerPage())
  if (!hasSupabaseConfig()) notFound()
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id)) notFound()
  const ownerId = await requireOwnerId().catch(() => 'no-auth')

  const instructor = await fetchInstructorById(id, ownerId)
  if (!instructor) notFound()

  // members·rates·passes는 instructor 결과에 의존하지 않음 → 병렬 조회 (이전엔 3번 직렬 await).
  const [members, allRates, allPasses] = await Promise.all([
    fetchMembersByInstructor(id, ownerId),
    fetchAllRates(ownerId).catch(() => []),
    fetchAllPasses(ownerId).catch(() => null),
  ])

  // 이 강사의 회원별 인센티브(회당) — 인라인 편집 prefill용. custom_rate·memo도 함께 보존.
  const rateByMember = new Map(allRates.filter(r => r.instructorId === id).map(r => [r.memberId, r]))

  // KPI 계산
  let kpi: ReturnType<typeof computeInstructorKPI> | null = null
  if (allPasses) {
    try {
      const instructorPasses = allPasses.filter(p => p.instructorId === id)
      const allByMember = groupPassesByMember(allPasses)
      kpi = computeInstructorKPI(id, instructorPasses, allByMember)
    } catch {
      kpi = null
    }
  }

  const roleLabel = instructor.role === 'owner' ? '스튜디오 오너' : instructor.role === 'admin' ? '관리자' : '강사'

  return (
    <div className="space-y-4 max-w-3xl">
      <a href="/instructors" className="text-sm text-neutral-500 hover:underline">← 강사 목록</a>
      <div className="flex items-center gap-3">
        {instructor.color && <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: instructor.color }} />}
        <h2 className="text-2xl font-semibold">{instructor.name}</h2>
        <span className="text-sm text-neutral-500">{roleLabel}</span>
      </div>

      <Card className="space-y-2">
        <Row label="전화번호" value={instructor.phone} />
        <Row label="개인 시급" value={`${instructor.ratePrivate.toLocaleString()}원`} />
        <Row label="재활 시급" value={`${instructor.rateRehab.toLocaleString()}원`} />
        <Row label="듀엣 시급" value={`${instructor.rateDuet.toLocaleString()}원`} />
        <Row label="그룹 시급" value={`${instructor.rateGroup.toLocaleString()}원`} />
      </Card>

      <InstructorAccountSection
        instructorId={instructor.id}
        instructorName={instructor.name}
        email={instructor.email}
        connected={instructor.authUserId != null}
      />

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          <KpiBox title="총 매출" value={`${kpi.totalRevenue.toLocaleString()}원`} sub={`${kpi.totalMemberCount}명 담당`} />
          <KpiBox title="활성 회원" value={`${kpi.activeMemberCount}명`} sub="이용중 수강권 보유" />
          <KpiBox title="재등록률" value={`${(kpi.reregistrationRate * 100).toFixed(0)}%`} sub={`${kpi.totalMemberCount}명 중 2회+ 결제`} />
          <KpiBox title="전환율" value={`${(kpi.trialConversionRate * 100).toFixed(0)}%`} sub={`체험 ${kpi.trialMemberCount}명 → 정회원 ${kpi.convertedMemberCount}명`} />
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mt-6 mb-1">
          담당 회원{' '}
          <span className="text-base font-normal text-neutral-500">
            (이용중 {members.filter(m => m.isActive).length}명 · 누적 {members.length}명)
          </span>
        </h3>
        <p className="text-xs text-neutral-500 mb-2">
          💡 회원별 <b>회당 인센티브</b>를 여기서 바로 입력·저장하면 월별 급여 정산에 자동 반영됩니다. (회원마다 다르게 줄 수 있어요)
        </p>
        {members.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 담당 회원이 없습니다.</p>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium whitespace-nowrap">이름</th>
                  <th className="text-left px-4 py-2 font-medium whitespace-nowrap">전화번호</th>
                  <th className="text-right px-4 py-2 font-medium whitespace-nowrap">수강권 수</th>
                  <th className="text-left px-4 py-2 font-medium whitespace-nowrap">최근 수강권</th>
                  <th className="text-left px-4 py-2 font-medium whitespace-nowrap">상태</th>
                  <th className="text-right px-4 py-2 font-medium whitespace-nowrap">인센티브 (회당)</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.memberId} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <a href={`/members/${m.memberId}`} className="font-medium text-blue-600 hover:underline">{m.memberName}</a>
                    </td>
                    <td className="px-4 py-2 text-neutral-600 whitespace-nowrap tabular-nums">{m.memberPhone ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-600 whitespace-nowrap text-right tabular-nums">{m.passCount}</td>
                    <td className="px-4 py-2 text-neutral-600 whitespace-nowrap">{m.latestPassName ?? '—'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded ${m.latestPassStatus === '이용중' ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {m.latestPassStatus ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <MemberIncentiveInput
                        memberId={m.memberId}
                        instructorId={id}
                        initialIncentive={rateByMember.get(m.memberId)?.incentivePerSession ?? 0}
                        customRate={rateByMember.get(m.memberId)?.customRate ?? null}
                        memo={rateByMember.get(m.memberId)?.memo ?? null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex">
      <div className="w-24 shrink-0 text-sm text-neutral-500">{label}</div>
      <div className="text-sm">{value ?? '—'}</div>
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
