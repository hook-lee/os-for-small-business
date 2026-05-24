import { fetchRecentMessages } from '@/lib/supabase/messages'
import { fetchAllMembers } from '@/lib/supabase/members'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { fetchAllPasses } from '@/lib/supabase/passes'
import { findExpiringMembers, findDormantMembers } from '@/lib/analytics/member-segments'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { MessagesComposer } from './MessagesComposer'
import { MembersTabBar } from '@/components/MembersTabBar'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const today = new Date().toISOString().slice(0, 10)
  let members: Awaited<ReturnType<typeof fetchAllMembers>> = []
  let instructors: Awaited<ReturnType<typeof fetchAllInstructors>> = []
  let passes: Awaited<ReturnType<typeof fetchAllPasses>> = []
  let recent: Awaited<ReturnType<typeof fetchRecentMessages>> = []
  if (hasSupabaseConfig()) {
    try {
      ;[members, instructors, passes, recent] = await Promise.all([
        fetchAllMembers(), fetchAllInstructors(), fetchAllPasses(), fetchRecentMessages(20),
      ])
    } catch {}
  }
  const expiring = findExpiringMembers(members, passes, today, 7).map(e => e.member)
  const dormant = findDormantMembers(members, today, 60).map(d => d.member)
  return (
    <>
      <MembersTabBar />
      <MessagesComposer
        members={members.map(m => ({ id: m.id, name: m.name, phone: m.phone }))}
        instructors={instructors.map(i => ({ id: i.id, name: i.name, phone: i.phone }))}
        expiringIds={expiring.map(m => m.id)}
        dormantIds={dormant.map(m => m.id)}
        recent={recent}
      />
    </>
  )
}
