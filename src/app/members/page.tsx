import { fetchAllMembers } from '@/lib/supabase/members'
import { fetchAllPasses } from '@/lib/supabase/passes'
import { findExpiringMembers, findDormantMembers } from '@/lib/analytics/member-segments'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { MembersTable } from './MembersTable'

export const dynamic = 'force-dynamic'

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const params = await searchParams
  const filter = params.filter ?? 'all'
  const today = new Date().toISOString().slice(0, 10)

  let members: Awaited<ReturnType<typeof fetchAllMembers>> = []
  let passes: Awaited<ReturnType<typeof fetchAllPasses>> = []
  if (hasSupabaseConfig()) {
    try {
      ;[members, passes] = await Promise.all([fetchAllMembers(), fetchAllPasses()])
    } catch {}
  }

  const expiring = findExpiringMembers(members, passes, today, 7)
  const dormant = findDormantMembers(members, today, 60)

  const expiringIds = new Set(expiring.map(e => e.member.id))
  const dormantIds = new Set(dormant.map(d => d.member.id))

  let displayed = members
  if (filter === 'expiring') displayed = members.filter(m => expiringIds.has(m.id))
  if (filter === 'dormant') displayed = members.filter(m => dormantIds.has(m.id))

  return (
    <div className="space-y-4">
      {!hasSupabaseConfig() && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
          Supabase 미설정 — 환경변수 설정 후 회원 데이터가 표시됩니다.
        </div>
      )}
      <MembersTable
        members={displayed}
        currentFilter={filter}
        totalCount={members.length}
        expiringCount={expiring.length}
        dormantCount={dormant.length}
      />
    </div>
  )
}
