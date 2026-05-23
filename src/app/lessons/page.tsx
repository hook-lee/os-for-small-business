import { fetchLessonsByDate, fetchLessonsByMonth } from '@/lib/supabase/lessons'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { LessonsManager } from './LessonsManager'

export const dynamic = 'force-dynamic'

export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams
  const date = params.date || new Date().toISOString().slice(0, 10)
  const month = date.slice(0, 7)

  const [lessons, monthLessons, instructors] = hasSupabaseConfig()
    ? await Promise.all([fetchLessonsByDate(date), fetchLessonsByMonth(month), fetchAllInstructors()])
    : [[], [], []]

  return (
    <LessonsManager
      initialDate={date}
      initialLessons={lessons}
      monthLessons={monthLessons}
      instructors={instructors}
    />
  )
}
