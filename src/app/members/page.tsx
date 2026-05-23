import { fetchAllMembers } from '@/lib/supabase/members'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { MembersTable } from './MembersTable'

export const dynamic = 'force-dynamic'

export default async function MembersPage() {
  const members = hasSupabaseConfig() ? await fetchAllMembers() : []
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">회원 <span className="text-neutral-400 text-sm font-normal">총 {members.length}명</span></h2>
      </div>
      {!hasSupabaseConfig() && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
          Supabase 미설정 — 환경변수 설정 후 회원 데이터가 표시됩니다.
        </div>
      )}
      <MembersTable members={members} />
    </div>
  )
}
