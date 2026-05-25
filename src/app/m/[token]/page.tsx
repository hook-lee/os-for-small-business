import { fetchMemberByToken } from '@/lib/supabase/members'
import { fetchActivePassesByMember } from '@/lib/supabase/passes'
import { fetchLessonsByMember } from '@/lib/supabase/lessons'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MemberHome({ params }: { params: Promise<{ token: string }> }) {
  if (!hasSupabaseConfig()) notFound()
  const { token } = await params
  const member = await fetchMemberByToken(token)
  if (!member) notFound()

  const memberOwnerId = member.ownerId ?? 'no-auth'
  const [activePasses, allLessons] = await Promise.all([
    fetchActivePassesByMember(member.id, memberOwnerId),
    fetchLessonsByMember(member.id, memberOwnerId),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const upcomingLessons = allLessons
    .filter(l => l.lessonDate >= today && (l.status === 'scheduled' || l.status === 'completed'))
    .sort((a, b) => a.lessonDate.localeCompare(b.lessonDate) || (a.lessonTime ?? '').localeCompare(b.lessonTime ?? ''))
    .slice(0, 3)

  // 가장 최근 활성 수강권 1개를 큰 카드로
  const primaryPass = activePasses.sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''))[0] ?? null

  return (
    <div className="space-y-4">
      {/* 메인 수강권 카드 */}
      {primaryPass ? (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="text-xs text-teal-600 font-semibold uppercase tracking-wider">현재 수강권</div>
          <div className="text-2xl font-bold mt-1">{primaryPass.passName}</div>
          <div className="text-xs text-neutral-500 mt-0.5">{primaryPass.passType}</div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-teal-600 tabular-nums">{primaryPass.remainingCount ?? 0}</span>
            <span className="text-sm text-neutral-500">/ {primaryPass.totalCount ?? 0}회 남음</span>
          </div>

          <div className="mt-3 h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500"
              style={{
                width: `${primaryPass.totalCount ? Math.max(0, Math.min(100, ((primaryPass.remainingCount ?? 0) / primaryPass.totalCount) * 100)) : 0}%`,
              }}
            />
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            만료일: {primaryPass.endDate ?? '—'}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-5 shadow-sm text-center text-neutral-400 text-sm">
          현재 이용중인 수강권이 없습니다.<br />문의: 라파 필라테스
        </div>
      )}

      {/* 다가오는 수업 */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-700 mb-2 px-1">다가오는 수업</h2>
        {upcomingLessons.length === 0 ? (
          <div className="bg-white rounded-xl p-5 text-center text-sm text-neutral-400">
            예정된 수업이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingLessons.map(l => (
              <div key={l.id} className="bg-white rounded-xl p-4 flex items-center gap-3">
                <div className="text-center w-14">
                  <div className="text-xs text-neutral-500">{l.lessonDate.slice(5).replace('-', '/')}</div>
                  <div className="font-bold text-sm">{l.lessonTime ?? '—'}</div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{l.memo ?? '수업'}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  l.status === 'completed' ? 'bg-green-100 text-green-700' :
                  l.status === 'scheduled' ? 'bg-teal-100 text-teal-700' :
                  'bg-neutral-100 text-neutral-500'
                }`}>
                  {l.status === 'completed' ? '완료' : l.status === 'scheduled' ? '예약' : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 회원 정보 카드 */}
      <div className="bg-white rounded-xl p-4 space-y-1">
        <div className="text-xs text-neutral-500">내 정보</div>
        <div className="text-sm">전화: {member.phone ?? '—'}</div>
        {member.email && <div className="text-sm">이메일: {member.email}</div>}
        <div className="text-sm text-neutral-500">등록일: {member.registeredAt ?? '—'}</div>
      </div>

      <div className="text-xs text-center text-neutral-400 pt-2 pb-4">
        라파 필라테스 · 정보 수정은 운영자에게 문의
      </div>
    </div>
  )
}
