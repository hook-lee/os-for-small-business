import { fetchInstructorById, fetchMembersByInstructor } from '@/lib/supabase/instructors'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function InstructorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!hasSupabaseConfig()) notFound()
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id)) notFound()

  const instructor = await fetchInstructorById(id)
  if (!instructor) notFound()

  const members = await fetchMembersByInstructor(id)

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

      <div>
        <h3 className="text-lg font-semibold mt-6 mb-2">담당 회원 ({members.length}명)</h3>
        {members.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 담당 회원이 없습니다.</p>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">이름</th>
                  <th className="text-left px-4 py-2 font-medium">전화번호</th>
                  <th className="text-left px-4 py-2 font-medium">수강권 수</th>
                  <th className="text-left px-4 py-2 font-medium">최근 수강권</th>
                  <th className="text-left px-4 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.memberId} className="border-t border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-2">
                      <a href={`/members/${m.memberId}`} className="font-medium text-blue-600 hover:underline">{m.memberName}</a>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">{m.memberPhone ?? '—'}</td>
                    <td className="px-4 py-2 text-neutral-600">{m.passCount}</td>
                    <td className="px-4 py-2 text-neutral-600">{m.latestPassName ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${m.latestPassStatus === '이용중' ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {m.latestPassStatus ?? '—'}
                      </span>
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
