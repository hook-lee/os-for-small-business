import { getSupabaseClient } from './client'

export interface GroupSession {
  id: number
  instructorId: number | null
  instructorName: string | null
  roomId: number | null
  roomName: string | null
  sessionName: string
  lessonDate: string
  lessonTime: string
  durationMinutes: number
  capacity: number
  notes: string | null
  active: boolean
  reservedCount: number
  attendedCount: number
}

interface GroupSessionRow {
  id: number
  instructor_id: number | null
  room_id: number | null
  session_name: string
  lesson_date: string
  lesson_time: string
  duration_minutes: number
  capacity: number
  notes: string | null
  active: boolean
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
    lessonDate: row.lesson_date,
    lessonTime: row.lesson_time,
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    notes: row.notes,
    active: row.active,
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
  if (error) throw new Error(`Create group session failed: ${error.message}`)
  return (data as { id: number }).id
}

export interface UpdateGroupSessionInput {
  roomId?: number | null
  lessonTime?: string | null
  instructorId?: number | null
  capacity?: number
  notes?: string | null
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
