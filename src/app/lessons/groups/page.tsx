import { fetchUpcomingGroupSessions } from '@/lib/supabase/group-sessions'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { LessonsTabs } from '../LessonsTabs'
import { GroupSessionsManager } from './GroupSessionsManager'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  const [sessions, instructors] = hasSupabaseConfig()
    ? await Promise.all([fetchUpcomingGroupSessions(ownerId), fetchAllInstructors(ownerId)])
    : [[], []]

  return (
    <>
      <LessonsTabs current="groups" />
      <GroupSessionsManager initialSessions={sessions} instructors={instructors} />
    </>
  )
}
