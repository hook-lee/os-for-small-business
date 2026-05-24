import { fetchMemberByToken } from '@/lib/supabase/members'
import { fetchLessonsByMember } from '@/lib/supabase/lessons'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MemberLessonsPage({ params }: { params: Promise<{ token: string }> }) {
  if (!hasSupabaseConfig()) notFound()
  const { token } = await params
  const member = await fetchMemberByToken(token)
  if (!member) notFound()

  const lessons = await fetchLessonsByMember(member.id)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = lessons.filter(l => l.lessonDate >= today).sort((a, b) =>
    a.lessonDate.localeCompare(b.lessonDate) || (a.lessonTime ?? '').localeCompare(b.lessonTime ?? '')
  )
  const past = lessons.filter(l => l.lessonDate < today).sort((a, b) =>
    b.lessonDate.localeCompare(a.lessonDate)
  )

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">내 일정</h1>

      <section>
        <div className="text-xs text-neutral-500 mb-2 font-medium">앞으로 ({upcoming.length})</div>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl p-4 text-sm text-neutral-400 text-center">예정된 수업이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(l => (
              <LessonRow key={l.id} lesson={l} accent="teal" />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="text-xs text-neutral-500 mb-2 font-medium">지난 수업 ({past.length})</div>
        {past.length === 0 ? (
          <div className="text-xs text-neutral-400">없음</div>
        ) : (
          <div className="space-y-2">
            {past.slice(0, 20).map(l => (
              <LessonRow key={l.id} lesson={l} accent="neutral" />
            ))}
            {past.length > 20 && (
              <div className="text-xs text-neutral-400 text-center pt-2">외 {past.length - 20}건</div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function LessonRow({ lesson: l, accent }: { lesson: { id: number; lessonDate: string; lessonTime: string | null; status: string; memo: string | null }; accent: 'teal' | 'neutral' }) {
  const statusLabel = l.status === 'completed' ? '완료' : l.status === 'scheduled' ? '예약' : l.status === 'cancelled_advance' ? '취소' : l.status === 'cancelled_same_day' ? '당일취소' : l.status === 'noshow' ? '노쇼' : '—'
  const statusColor = l.status === 'completed' ? 'bg-green-100 text-green-700' : l.status === 'scheduled' ? 'bg-teal-100 text-teal-700' : 'bg-neutral-100 text-neutral-500'

  return (
    <div className={`bg-white rounded-xl p-3 flex items-center gap-3 ${accent === 'neutral' ? 'opacity-70' : ''}`}>
      <div className="text-center w-14">
        <div className="text-xs text-neutral-500">{l.lessonDate.slice(5).replace('-', '/')}</div>
        <div className="font-bold text-sm">{l.lessonTime ?? '—'}</div>
      </div>
      <div className="flex-1 text-xs text-neutral-500">
        {l.memo ?? ''}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>{statusLabel}</span>
    </div>
  )
}
