import { getSupabaseClient } from './client'
import { bucketLessonCounts } from '@/lib/analytics/payroll-auto'

export async function fetchAutoPayrollCounts(instructorId: number, yearMonth: string): Promise<{
  privateCount: number; rehabCount: number; duetCount: number; groupCount: number;
  individualLessonsCount: number;
  groupSessionsCount: number;
}> {
  try {
    const supabase = getSupabaseClient()
    const [y, m] = yearMonth.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const start = `${yearMonth}-01`
    const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

    const { data: lessons } = await supabase
      .from('lessons')
      .select('pass_id, passes(pass_name)')
      .eq('instructor_id', instructorId)
      .gte('lesson_date', start)
      .lte('lesson_date', end)
      .in('status', ['completed', 'cancelled_same_day', 'noshow'])

    const { data: groupSessions } = await supabase
      .from('group_sessions')
      .select('id')
      .eq('instructor_id', instructorId)
      .eq('active', true)
      .gte('lesson_date', start)
      .lte('lesson_date', end)

    type LessonRow = { pass_id: number | null; passes: { pass_name: string } | { pass_name: string }[] | null }
    const passNames = ((lessons ?? []) as LessonRow[]).map(l => {
      const p = Array.isArray(l.passes) ? l.passes[0] : l.passes
      return p?.pass_name ?? null
    })

    const counts = bucketLessonCounts(passNames, (groupSessions ?? []).length)
    return {
      ...counts,
      individualLessonsCount: passNames.length,
      groupSessionsCount: (groupSessions ?? []).length,
    }
  } catch {
    return { privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0, individualLessonsCount: 0, groupSessionsCount: 0 }
  }
}
