import { fetchUpcomingGroupSessions } from '@/lib/supabase/group-sessions'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { LessonsTabs } from '../LessonsTabs'
import { GroupSessionsManager } from './GroupSessionsManager'

export const dynamic = 'force-dynamic'

export default async function GroupsPage() {
  const [sessions, instructors] = hasSupabaseConfig()
    ? await Promise.all([fetchUpcomingGroupSessions(), fetchAllInstructors()])
    : [[], []]

  return (
    <>
      <LessonsTabs current="groups" />
      <GroupSessionsManager initialSessions={sessions} instructors={instructors} />
    </>
  )
}
