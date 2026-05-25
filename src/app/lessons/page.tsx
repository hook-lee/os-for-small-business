import { fetchLessonsByDate, fetchLessonsByMonth } from '@/lib/supabase/lessons'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { LessonsManager } from './LessonsManager'
import { LessonsTabs } from './LessonsTabs'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams
  const date = params.date || new Date().toISOString().slice(0, 10)
  const month = date.slice(0, 7)
  const ownerId = await requireOwnerId().catch(() => 'no-auth')

  const [lessons, monthLessons, instructors] = hasSupabaseConfig()
    ? await Promise.all([fetchLessonsByDate(date, ownerId), fetchLessonsByMonth(month, ownerId), fetchAllInstructors(ownerId)])
    : [[], [], []]

  return (
    <>
      <LessonsTabs current="individual" />
      <LessonsManager
        initialDate={date}
        initialLessons={lessons}
        monthLessons={monthLessons}
        instructors={instructors}
      />
    </>
  )
}
