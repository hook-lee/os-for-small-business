import { getSupabaseClient } from './client'

export interface GroupSession {
  id: number
  instructorId: number | null
  instructorName: string | null
  roomId: number | null
  roomName: string | null
  sessionName: string
  category: string          // 수업 종류: 개인/재활/듀엣/그룹 (예약형 수업 통합 모델, 급여 종류별 집계)
  lessonDate: string
  lessonTime: string
  durationMinutes: number
  capacity: number
  notes: string | null
  active: boolean
  cancelReason: string | null
  cancelledAt: string | null
  reservedCount: number
  attendedCount: number
}

interface GroupSessionRow {
  id: number
  instructor_id: number | null
  room_id: number | null
  session_name: string
  category: string | null
  lesson_date: string
  lesson_time: string
  duration_minutes: number
  capacity: number
  notes: string | null
  active: boolean
  cancel_reason?: string | null
  cancelled_at?: string | null
  created_at: string
  instructors: { id: number; name: string } | null
  rooms: { id: number; name: string } | null
}

function rowToSession(row: GroupSessionRow, reservedCount = 0, attendedCount = 0): GroupSession {
  return {
    id: row.id,
    instructorId: row.instructor_id,
    instructorName: row.instructors?.name ?? null,
    roomId: row.room_id,
    roomName: row.rooms?.name ?? null,
    sessionName: row.session_name,
    category: row.category ?? '그룹',
    lessonDate: row.lesson_date,
    lessonTime: row.lesson_time,
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    notes: row.notes,
    active: row.active,
    cancelReason: row.cancel_reason ?? null,
    cancelledAt: row.cancelled_at ?? null,
    reservedCount,
    attendedCount,
  }
}

export async function fetchUpcomingGroupSessions(ownerId: string): Promise<GroupSession[]> {
  try {
    const supabase = getSupabaseClient()
    const today = new Date().toISOString().slice(0, 10)
    let q = supabase
      .from('group_sessions')
      .select('*, instructors(id, name), rooms(id, name)')
      .gte('lesson_date', today)
      .eq('active', true)
      .order('lesson_date', { ascending: true })
      .order('lesson_time', { ascending: true })
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error) return []

    const sessions = (data ?? []) as GroupSessionRow[]
    if (sessions.length === 0) return []

    const sessionIds = sessions.map(s => s.id)
    // group_reservations는 마이그레이션 12개 테이블 목록에 없음 — owner_id 컬럼 없으므로 sessionIds로만 필터.
    const { data: reservations } = await supabase
      .from('group_reservations')
      .select('session_id, status')
      .in('session_id', sessionIds)

    // Group counts by session_id
    const reservedMap = new Map<number, number>()
    const attendedMap = new Map<number, number>()
    for (const r of (reservations ?? []) as { session_id: number; status: string }[]) {
      if (r.status === 'reserved') {
        reservedMap.set(r.session_id, (reservedMap.get(r.session_id) ?? 0) + 1)
      } else if (r.status === 'attended') {
        attendedMap.set(r.session_id, (attendedMap.get(r.session_id) ?? 0) + 1)
      }
    }

    return sessions.map(row =>
      rowToSession(row, reservedMap.get(row.id) ?? 0, attendedMap.get(row.id) ?? 0)
    )
  } catch {
    return []
  }
}

export async function fetchSessionById(id: number, ownerId: string): Promise<GroupSession | null> {
  try {
    const supabase = getSupabaseClient()
    let q = supabase
      .from('group_sessions')
      .select('*, instructors(id, name), rooms(id, name)')
      .eq('id', id)
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q.maybeSingle()
    if (error || !data) return null

    const row = data as GroupSessionRow
    const { data: reservations } = await supabase
      .from('group_reservations')
      .select('session_id, status')
      .eq('session_id', id)

    let reservedCount = 0
    let attendedCount = 0
    for (const r of (reservations ?? []) as { session_id: number; status: string }[]) {
      if (r.status === 'reserved') reservedCount++
      else if (r.status === 'attended') attendedCount++
    }

    return rowToSession(row, reservedCount, attendedCount)
  } catch {
    return null
  }
}

export interface CreateGroupSessionInput {
  instructorId?: number | null
  roomId?: number | null
  sessionName: string
  category?: string
  lessonDate: string
  lessonTime: string
  durationMinutes?: number
  capacity?: number
  notes?: string
}

export async function createGroupSession(input: CreateGroupSessionInput, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {
    instructor_id: input.instructorId ?? null,
    room_id: input.roomId ?? null,
    session_name: input.sessionName,
    category: input.category ?? '그룹',
    lesson_date: input.lessonDate,
    lesson_time: input.lessonTime,
    duration_minutes: input.durationMinutes ?? 50,
    capacity: input.capacity ?? 4,
    notes: input.notes ?? null,
    active: true,
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase
    .from('group_sessions')
    .insert(row)
    .select('id')
    .single()
  if (error) {
    // category 컬럼이 아직 없는 배포 DB(마이그레이션 v3.12 전) 폴백: category 빼고 재시도
    if (/category/i.test(error.message)) {
      const rest: Record<string, unknown> = { ...row }
      delete rest.category
      const retry = await supabase.from('group_sessions').insert(rest).select('id').single()
      if (retry.error) throw new Error(`Create group session failed: ${retry.error.message}`)
      return (retry.data as { id: number }).id
    }
    throw new Error(`Create group session failed: ${error.message}`)
  }
  return (data as { id: number }).id
}

export interface UpdateGroupSessionInput {
  roomId?: number | null
  lessonTime?: string | null
  instructorId?: number | null
  capacity?: number
  notes?: string | null
  category?: string
  lessonDate?: string   // 드래그로 다른 날 이동 시 (예약자는 FK로 따라옴)
}

export async function updateGroupSession(id: number, patch: UpdateGroupSessionInput, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const dbPatch: Record<string, unknown> = {}
  if (patch.roomId !== undefined) dbPatch.room_id = patch.roomId
  if (patch.lessonTime !== undefined) dbPatch.lesson_time = patch.lessonTime
  if (patch.instructorId !== undefined) dbPatch.instructor_id = patch.instructorId
  if (patch.capacity !== undefined) dbPatch.capacity = patch.capacity
  if (patch.notes !== undefined) dbPatch.notes = patch.notes
  if (patch.category !== undefined) dbPatch.category = patch.category
  if (patch.lessonDate !== undefined) dbPatch.lesson_date = patch.lessonDate
  if (Object.keys(dbPatch).length === 0) return

  let q = supabase.from('group_sessions').update(dbPatch).eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Update group session failed: ${error.message}`)
}

export async function deleteGroupSession(id: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  let q = supabase.from('group_sessions').delete().eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Delete group session failed: ${error.message}`)
}

/**
 * 그룹 수업 취소(soft) — active=false + 사유 기록(이력 보존, 폐강률 분석에 사용).
 * cancel_reason 컬럼이 아직 없는 DB(v3.23 전)면 active만 끄는 폴백.
 */
export async function cancelGroupSession(id: number, reason: string, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const patch: Record<string, unknown> = {
    active: false,
    cancel_reason: reason,
    cancelled_at: new Date().toISOString(),
  }
  let q = supabase.from('group_sessions').update(patch).eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) {
    if (/cancel_reason|cancelled_at/i.test(error.message)) {
      // 컬럼 미존재 폴백 — active만 끔
      let q2 = supabase.from('group_sessions').update({ active: false }).eq('id', id)
      if (ownerId !== 'no-auth') q2 = q2.eq('owner_id', ownerId)
      const retry = await q2
      if (retry.error) throw new Error(`Cancel group session failed: ${retry.error.message}`)
      return
    }
    throw new Error(`Cancel group session failed: ${error.message}`)
  }
}

/** 폐강률 분석용 경량 조회 — 모든 그룹 세션(진행+취소). 예약 수 미포함. */
export interface GroupSessionLite {
  instructorId: number | null
  category: string
  lessonDate: string
  active: boolean
  cancelReason: string | null
}

export async function fetchGroupSessionsForAnalytics(ownerId: string): Promise<GroupSessionLite[]> {
  try {
    const supabase = getSupabaseClient()
    const sel = (cols: string) => {
      let q = supabase.from('group_sessions').select(cols)
      if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
      return q
    }
    let { data, error } = await sel('instructor_id, category, lesson_date, active, cancel_reason')
    if (error && /cancel_reason/i.test(error.message)) {
      ;({ data, error } = await sel('instructor_id, category, lesson_date, active'))
    }
    if (error) return []
    return ((data ?? []) as unknown as Array<{
      instructor_id: number | null; category: string | null; lesson_date: string; active: boolean; cancel_reason?: string | null
    }>).map(r => ({
      instructorId: r.instructor_id,
      category: r.category ?? '그룹',
      lessonDate: r.lesson_date,
      active: r.active,
      cancelReason: r.cancel_reason ?? null,
    }))
  } catch {
    return []
  }
}
