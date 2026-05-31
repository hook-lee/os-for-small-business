import { fetchUnifiedLessonsByRange } from '@/lib/supabase/lessons-combined'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { LessonsTabs } from './LessonsTabs'
import { UnifiedLessonsView } from './UnifiedLessonsView'
import { getRangeForView, type ViewMode } from '@/lib/analytics/lessons-view'

export const dynamic = 'force-dynamic'

function parseMode(raw: string | undefined): ViewMode {
  if (raw === '주별' || raw === '월별' || raw === '일별') return raw
  return '일별'
}

export default async function LessonsAllPage({ searchParams }: { searchParams: Promise<{ date?: string; mode?: string }> }) {
  const params = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const anchor = params.date || today
  const mode = parseMode(params.mode)
  const ownerId = await requireOwnerId().catch(() => 'no-auth')

  const { start, end } = getRangeForView(mode, anchor)
  const [lessons, instructors] = hasSupabaseConfig()
    ? await Promise.all([
        fetchUnifiedLessonsByRange(start, end, ownerId),
        fetchAllInstructors(ownerId),
      ])
    : [[], []]

  // 강사별 컬럼/필터에서 사용할 최소 형태로 변환 (id/name/role/color)
  const instructorRefs = instructors.map(i => ({
    id: i.id,
    name: i.name,
    role: i.role,
    color: i.color,
  }))

  return (
    <>
      <LessonsTabs current="all" />
      <UnifiedLessonsView
        initialAnchor={anchor}
        initialMode={mode}
        lessons={lessons}
        instructors={instructorRefs}
      />
    </>
  )
}
