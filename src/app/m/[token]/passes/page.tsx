import { fetchMemberByToken } from '@/lib/supabase/members'
import { fetchPassesByMember } from '@/lib/supabase/passes'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MemberPassesPage({ params }: { params: Promise<{ token: string }> }) {
  if (!hasSupabaseConfig()) notFound()
  const { token } = await params
  const member = await fetchMemberByToken(token)
  if (!member) notFound()

  const passes = await fetchPassesByMember(member.id)
  const active = passes.filter(p => p.status === '이용중')
  const expired = passes.filter(p => p.status !== '이용중')

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">내 수강권</h1>

      <section>
        <div className="text-xs text-neutral-500 mb-2 font-medium">이용중 ({active.length})</div>
        {active.length === 0 ? (
          <div className="bg-white rounded-xl p-4 text-sm text-neutral-400 text-center">이용중인 수강권이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {active.map(p => (
              <div key={p.id} className="bg-white rounded-xl p-4 border-l-4 border-teal-500">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.passName}</div>
                  <span className="text-xs px-2 py-0.5 rounded bg-teal-100 text-teal-700">이용중</span>
                </div>
                <div className="text-xs text-neutral-500 mt-1">{p.passType ?? '—'}</div>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-teal-600 tabular-nums">{p.remainingCount ?? 0}</span>
                  <span className="text-xs text-neutral-500">/ {p.totalCount ?? 0}회</span>
                </div>
                <div className="mt-2 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500" style={{ width: `${p.totalCount ? Math.max(0, Math.min(100, ((p.remainingCount ?? 0) / p.totalCount) * 100)) : 0}%` }} />
                </div>
                <div className="text-xs text-neutral-500 mt-2">
                  {p.startDate ?? '—'} ~ {p.endDate ?? '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="text-xs text-neutral-500 mb-2 font-medium">이전 수강권 ({expired.length})</div>
        {expired.length === 0 ? (
          <div className="text-xs text-neutral-400">없음</div>
        ) : (
          <div className="space-y-2">
            {expired.slice(0, 10).map(p => (
              <div key={p.id} className="bg-white rounded-lg p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{p.passName}</span>
                  <span className="text-xs text-neutral-500">{p.status}</span>
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {p.startDate ?? '—'} ~ {p.endDate ?? '—'} · {p.totalCount}회
                </div>
              </div>
            ))}
            {expired.length > 10 && (
              <div className="text-xs text-neutral-400 text-center pt-2">외 {expired.length - 10}건</div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
