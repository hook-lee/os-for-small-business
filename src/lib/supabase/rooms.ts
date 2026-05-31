import { getSupabaseClient } from './client'

/**
 * 룸 (수업 공간) — owner_id 격리.
 * 시드: 신규 가입 시 ensureDefaultRoom로 '메인실' 자동 생성.
 */

export interface Room {
  id: number
  name: string
  displayOrder: number
  isActive: boolean
}

interface RoomRow {
  id: number
  name: string
  display_order: number
  is_active: boolean
}

function rowToRoom(r: RoomRow): Room {
  return {
    id: r.id,
    name: r.name,
    displayOrder: r.display_order,
    isActive: r.is_active,
  }
}

export async function fetchAllRooms(ownerId: string): Promise<Room[]> {
  const supabase = getSupabaseClient()
  let q = supabase
    .from('rooms')
    .select('*')
    .order('display_order', { ascending: true })
    .order('id', { ascending: true })
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) throw new Error(`Supabase rooms fetch failed: ${error.message}`)
  return ((data ?? []) as RoomRow[]).map(rowToRoom)
}

export async function fetchActiveRooms(ownerId: string): Promise<Room[]> {
  const all = await fetchAllRooms(ownerId)
  return all.filter(r => r.isActive)
}

export async function createRoom(
  input: { name: string; displayOrder?: number },
  ownerId: string,
): Promise<number> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {
    name: input.name,
    display_order: input.displayOrder ?? 0,
    is_active: true,
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase
    .from('rooms')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`Insert room failed: ${error.message}`)
  return (data as { id: number }).id
}

export async function updateRoom(
  id: number,
  patch: { name?: string; displayOrder?: number; isActive?: boolean },
  ownerId: string,
): Promise<void> {
  const supabase = getSupabaseClient()
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.displayOrder !== undefined) dbPatch.display_order = patch.displayOrder
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive

  let q = supabase.from('rooms').update(dbPatch).eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Room update failed: ${error.message}`)
}

export async function deleteRoom(id: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  // ON DELETE SET NULL이라 수업의 room_id가 NULL이 됨 (이력 보존)
  let q = supabase.from('rooms').delete().eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Room delete failed: ${error.message}`)
}

/**
 * owner가 룸 1개 없으면 '메인실' 1개 생성 (멱등).
 * 신규 가입 직후 호출.
 */
export async function ensureDefaultRoom(ownerId: string): Promise<void> {
  if (ownerId === 'no-auth') return
  const existing = await fetchAllRooms(ownerId)
  if (existing.length > 0) return
  await createRoom({ name: '메인실', displayOrder: 0 }, ownerId)
}

/**
 * 룸·날짜·시간 충돌 검사 (cross-table: lessons + group_sessions).
 *
 * 단일 테이블 내 충돌은 DB UNIQUE INDEX가 막아주지만
 * lessons ↔ group_sessions 사이 같은 룸·시간 충돌은 application layer에서만 검증 가능.
 *
 * @param excludeLessonId 자기 자신 제외 (수정 시)
 * @param excludeGroupSessionId 자기 자신 제외
 * @returns 충돌하는 row 1개 (있으면) — 없으면 null
 */
export interface ConflictInfo {
  type: 'individual' | 'group'
  id: number
  description: string
}

export async function findRoomTimeConflict(
  ownerId: string,
  roomId: number,
  date: string,
  time: string,
  exclude?: { lessonId?: number; groupSessionId?: number },
): Promise<ConflictInfo | null> {
  const supabase = getSupabaseClient()

  // lessons 체크
  let lq = supabase
    .from('lessons')
    .select('id, members(name)')
    .eq('room_id', roomId)
    .eq('lesson_date', date)
    .eq('lesson_time', time)
    .limit(1)
  if (ownerId !== 'no-auth') lq = lq.eq('owner_id', ownerId)
  if (exclude?.lessonId !== undefined) lq = lq.neq('id', exclude.lessonId)
  const { data: ldata, error: lerr } = await lq
  if (lerr) throw new Error(`Conflict check (lessons) failed: ${lerr.message}`)
  const lrow = (ldata ?? [])[0] as
    | { id: number; members: { name: string } | { name: string }[] | null }
    | undefined
  if (lrow) {
    const m = Array.isArray(lrow.members) ? lrow.members[0] : lrow.members
    return {
      type: 'individual',
      id: lrow.id,
      description: m?.name ? `${m.name} 개별수업` : '개별수업',
    }
  }

  // group_sessions 체크
  let gq = supabase
    .from('group_sessions')
    .select('id, session_name')
    .eq('room_id', roomId)
    .eq('lesson_date', date)
    .eq('lesson_time', time)
    .limit(1)
  if (ownerId !== 'no-auth') gq = gq.eq('owner_id', ownerId)
  if (exclude?.groupSessionId !== undefined) gq = gq.neq('id', exclude.groupSessionId)
  const { data: gdata, error: gerr } = await gq
  if (gerr) throw new Error(`Conflict check (group_sessions) failed: ${gerr.message}`)
  const grow = (gdata ?? [])[0] as { id: number; session_name: string } | undefined
  if (grow) {
    return {
      type: 'group',
      id: grow.id,
      description: `${grow.session_name} 그룹수업`,
    }
  }

  return null
}
