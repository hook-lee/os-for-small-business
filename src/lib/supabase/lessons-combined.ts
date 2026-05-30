/**
 * 개별 수업(lessons) + 그룹 수업(group_sessions)을 한 화면에 보기 위한 통합 fetch.
 *
 * 반환 타입 UnifiedLesson은 두 source를 공통 인터페이스로 매핑:
 * - type='individual': 개별 수업, memberName + passName 있음
 * - type='group':      그룹 세션, sessionName + reservedCount/capacity
 *
 * owner_id 격리: lessons + group_sessions 둘 다 owner_id 컬럼 보유 → .eq 필수.
 */
import { getSupabaseClient, hasSupabaseConfig } from './client'

export type UnifiedLessonType = 'individual' | 'group'

export interface UnifiedLesson {
  id: number                       // lesson id 또는 group_session id
  type: UnifiedLessonType
  date: string                     // YYYY-MM-DD
  time: string | null              // HH:MM
  durationMinutes: number

  // 강사 공통
  instructorId: number | null
  instructorName: string | null

  // 개별 전용
  memberId: number | null
  memberName: string | null
  passName: string | null          // '개인', '재활' 등 — 수업 종류 분류용
  status: string | null            // 'scheduled' / 'completed' / ...

  // 그룹 전용
  sessionName: string | null
  capacity: number | null
  reservedCount: number | null
}

interface IndividualRow {
  id: number
  lesson_date: string
  lesson_time: string | null
  duration_minutes: number
  instructor_id: number | null
  member_id: number
  status: string
  instructors: { id: number; name: string } | null
  members: { id: number; name: string } | null
  passes: { id: number; pass_name: string } | null
}

interface GroupRow {
  id: number
  session_name: string
  lesson_date: string
  lesson_time: string
  duration_minutes: number
  capacity: number
  instructor_id: number | null
  instructors: { id: number; name: string } | null
}

interface ReservationCount {
  session_id: number
  count: number
}

/**
 * 지정 범위(`start` ~ `end`, inclusive)의 모든 수업 통합.
 */
export async function fetchUnifiedLessonsByRange(
  start: string,           // YYYY-MM-DD
  end: string,             // YYYY-MM-DD
  ownerId: string,
): Promise<UnifiedLesson[]> {
  if (!hasSupabaseConfig()) return []
  try {
    const supabase = getSupabaseClient()

    // 개별 수업
    let indQ = supabase
      .from('lessons')
      .select('id, lesson_date, lesson_time, duration_minutes, instructor_id, member_id, status, instructors(id, name), members(id, name), passes(id, pass_name)')
      .gte('lesson_date', start)
      .lte('lesson_date', end)
      .order('lesson_date', { ascending: true })
      .order('lesson_time', { ascending: true, nullsFirst: false })
    if (ownerId !== 'no-auth') indQ = indQ.eq('owner_id', ownerId)
    const { data: indData, error: indErr } = await indQ
    if (indErr) return []

    // 그룹 세션
    let grpQ = supabase
      .from('group_sessions')
      .select('id, session_name, lesson_date, lesson_time, duration_minutes, capacity, instructor_id, instructors(id, name)')
      .gte('lesson_date', start)
      .lte('lesson_date', end)
      .order('lesson_date', { ascending: true })
      .order('lesson_time', { ascending: true })
    if (ownerId !== 'no-auth') grpQ = grpQ.eq('owner_id', ownerId)
    const { data: grpData, error: grpErr } = await grpQ
    if (grpErr) return []

    const groupRows = (grpData ?? []) as unknown as GroupRow[]

    // 그룹 reservations 카운트 (cancelled 제외)
    let reservedCounts = new Map<number, number>()
    if (groupRows.length > 0) {
      const ids = groupRows.map(g => g.id)
      const { data: resData } = await supabase
        .from('group_reservations')
        .select('session_id')
        .in('session_id', ids)
        .neq('status', 'cancelled')
      for (const r of (resData ?? []) as Array<{ session_id: number }>) {
        reservedCounts.set(r.session_id, (reservedCounts.get(r.session_id) ?? 0) + 1)
      }
    }

    const individuals: UnifiedLesson[] = ((indData ?? []) as unknown as IndividualRow[]).map(r => ({
      id: r.id,
      type: 'individual' as const,
      date: r.lesson_date,
      time: r.lesson_time,
      durationMinutes: r.duration_minutes,
      instructorId: r.instructor_id,
      instructorName: r.instructors?.name ?? null,
      memberId: r.member_id,
      memberName: r.members?.name ?? null,
      passName: r.passes?.pass_name ?? null,
      status: r.status,
      sessionName: null,
      capacity: null,
      reservedCount: null,
    }))

    const groups: UnifiedLesson[] = groupRows.map(r => ({
      id: r.id,
      type: 'group' as const,
      date: r.lesson_date,
      time: r.lesson_time,
      durationMinutes: r.duration_minutes,
      instructorId: r.instructor_id,
      instructorName: r.instructors?.name ?? null,
      memberId: null,
      memberName: null,
      passName: null,
      status: null,
      sessionName: r.session_name,
      capacity: r.capacity,
      reservedCount: reservedCounts.get(r.id) ?? 0,
    }))

    // 합쳐서 시간순 정렬
    return [...individuals, ...groups].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return (a.time ?? '').localeCompare(b.time ?? '')
    })
  } catch {
    return []
  }
}
