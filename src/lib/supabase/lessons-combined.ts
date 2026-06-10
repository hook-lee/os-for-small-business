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
import { loadStudioSettings } from './studio-settings'
import { payrollCountedStatuses } from '@/lib/analytics/payroll-auto'

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
  instructorColor: string | null   // hex (#3b82f6 등). NULL이면 회색 fallback
  instructorRole: 'owner' | 'instructor' | 'admin' | null

  // 룸 공통
  roomId: number | null
  roomName: string | null

  // 개별 전용
  memberId: number | null
  memberName: string | null
  passName: string | null          // '개인', '재활' 등 — 수업 종류 분류용
  passRemaining: number | null     // 수강권 잔여 회차 (호버 툴팁용)
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
  room_id: number | null
  status: string
  instructors: { id: number; name: string; color: string | null; role: string | null } | null
  members: { id: number; name: string } | null
  passes: { id: number; pass_name: string; remaining_count: number | null } | null
  rooms: { id: number; name: string } | null
}

interface GroupRow {
  id: number
  session_name: string
  lesson_date: string
  lesson_time: string
  duration_minutes: number
  capacity: number
  instructor_id: number | null
  room_id: number | null
  instructors: { id: number; name: string; color: string | null; role: string | null } | null
  rooms: { id: number; name: string } | null
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

    // 일정에 보이는 상태 = 급여에 '계산되는' 상태와 일치시킨다.
    //  - 항상: 예약(scheduled)·완료(completed)
    //  - 당일취소·노쇼: 급여 반영 설정이 켜진 경우에만 표시(취소 마크). 끄면 일정에서 숨김(미계산).
    //  - 사전취소(cancelled_advance): 미계산 → 항상 숨김. (기록은 DB·회원로그에 보존)
    const settings = await loadStudioSettings(ownerId)
    const visibleStatuses = payrollCountedStatuses({
      sameDayCancel: settings.payrollCountsSameDayCancel,
      noshow: settings.payrollCountsNoshow,
    })

    // 개별 수업
    let indQ = supabase
      .from('lessons')
      .select('id, lesson_date, lesson_time, duration_minutes, instructor_id, member_id, room_id, status, instructors(id, name, color, role), members(id, name), passes(id, pass_name, remaining_count), rooms(id, name)')
      .gte('lesson_date', start)
      .lte('lesson_date', end)
      .in('status', visibleStatuses)
      .order('lesson_date', { ascending: true })
      .order('lesson_time', { ascending: true, nullsFirst: false })
    if (ownerId !== 'no-auth') indQ = indQ.eq('owner_id', ownerId)
    const { data: indData, error: indErr } = await indQ
    if (indErr) return []

    // 그룹 세션
    let grpQ = supabase
      .from('group_sessions')
      .select('id, session_name, lesson_date, lesson_time, duration_minutes, capacity, instructor_id, room_id, instructors(id, name, color, role), rooms(id, name)')
      .gte('lesson_date', start)
      .lte('lesson_date', end)
      .eq('active', true)   // 취소(폐강)된 세션은 일정에서 숨김
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
      instructorColor: r.instructors?.color ?? null,
      instructorRole: (r.instructors?.role ?? null) as UnifiedLesson['instructorRole'],
      roomId: r.room_id,
      roomName: r.rooms?.name ?? null,
      memberId: r.member_id,
      memberName: r.members?.name ?? null,
      passName: r.passes?.pass_name ?? null,
      passRemaining: r.passes?.remaining_count ?? null,
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
      instructorColor: r.instructors?.color ?? null,
      instructorRole: (r.instructors?.role ?? null) as UnifiedLesson['instructorRole'],
      roomId: r.room_id,
      roomName: r.rooms?.name ?? null,
      memberId: null,
      memberName: null,
      passName: null,
      passRemaining: null,
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
