import { getSupabaseClient } from './client'

export type ReservationStatus = 'reserved' | 'cancelled' | 'attended' | 'noshow'

const DEDUCTED_STATUSES: ReservationStatus[] = ['attended', 'noshow']
export function reservationDeducts(s: ReservationStatus): boolean {
  return DEDUCTED_STATUSES.includes(s)
}

export interface Reservation {
  id: number
  sessionId: number
  memberId: number
  memberName: string
  memberPhone: string | null
  passId: number | null
  status: ReservationStatus
  deducted: boolean
  reservedAt: string | null
  cancelledAt: string | null
}

interface ReservationRow {
  id: number
  session_id: number
  member_id: number
  pass_id: number | null
  status: string
  deducted: boolean
  reserved_at: string | null
  cancelled_at: string | null
  created_at: string
  members: { id: number; name: string; phone: string | null } | null
}

function rowToReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    sessionId: row.session_id,
    memberId: row.member_id,
    memberName: row.members?.name ?? '?',
    memberPhone: row.members?.phone ?? null,
    passId: row.pass_id,
    status: row.status as ReservationStatus,
    deducted: row.deducted,
    reservedAt: row.reserved_at,
    cancelledAt: row.cancelled_at,
  }
}

/**
 * 세션의 예약자 목록.
 * group_reservations엔 owner_id 컬럼이 없으므로 **부모 세션의 owner_id로 간접 격리**한다.
 * ownerId가 주어지면(='no-auth' 아님) 세션이 그 owner 것인지 먼저 확인 → 아니면 [] 반환.
 */
export async function fetchReservationsBySession(sessionId: number, ownerId: string): Promise<Reservation[]> {
  try {
    const supabase = getSupabaseClient()
    if (ownerId !== 'no-auth') {
      const { data: sess } = await supabase
        .from('group_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('owner_id', ownerId)
        .maybeSingle()
      if (!sess) return []   // 내 세션이 아니면 예약자(회원 PII)를 노출하지 않음
    }
    const { data, error } = await supabase
      .from('group_reservations')
      .select('*, members(id, name, phone)')
      .eq('session_id', sessionId)
      .order('reserved_at', { ascending: true })
    if (error) return []
    return ((data ?? []) as ReservationRow[]).map(rowToReservation)
  } catch {
    return []
  }
}

export async function fetchReservationsByMember(memberId: number): Promise<Reservation[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('group_reservations')
      .select('*, members(id, name, phone)')
      .eq('member_id', memberId)
      .order('reserved_at', { ascending: false })
    if (error) return []
    return ((data ?? []) as ReservationRow[]).map(rowToReservation)
  } catch {
    return []
  }
}

export async function createReservation({
  sessionId,
  memberId,
  passId,
}: {
  sessionId: number
  memberId: number
  passId?: number | null
}, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()

  // owner 격리: 세션이 이 owner 것인지 확인하며 capacity 조회 (남의 세션에 예약 주입 방지)
  let sq = supabase.from('group_sessions').select('capacity').eq('id', sessionId)
  if (ownerId !== 'no-auth') sq = sq.eq('owner_id', ownerId)
  const { data: sessionData, error: sessionError } = await sq.single()
  if (sessionError || !sessionData) throw new Error('세션을 찾을 수 없습니다.')
  const capacity = (sessionData as { capacity: number }).capacity

  // owner 격리: 회원도 이 owner 것인지 확인 (남의 회원을 내 세션에 끼워넣는 것 방지)
  if (ownerId !== 'no-auth') {
    const { data: mem } = await supabase
      .from('members')
      .select('id')
      .eq('id', memberId)
      .eq('owner_id', ownerId)
      .maybeSingle()
    if (!mem) throw new Error('회원을 찾을 수 없습니다.')
  }

  const { count: reservedCount } = await supabase
    .from('group_reservations')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('status', 'reserved')
  if ((reservedCount ?? 0) >= capacity) throw new Error('정원이 마감되었습니다.')

  // Check duplicate (already reserved or attended)
  const { data: existingData } = await supabase
    .from('group_reservations')
    .select('id, status')
    .eq('session_id', sessionId)
    .eq('member_id', memberId)
    .in('status', ['reserved', 'attended'])
    .maybeSingle()
  if (existingData) throw new Error('이미 예약된 세션입니다.')

  const { data, error } = await supabase
    .from('group_reservations')
    .insert({
      session_id: sessionId,
      member_id: memberId,
      pass_id: passId ?? null,
      status: 'reserved',
      deducted: false,
    })
    .select('id')
    .single()
  if (error) throw new Error(`예약 생성 실패: ${error.message}`)
  return (data as { id: number }).id
}

export async function setReservationStatus(
  reservationId: number,
  newStatus: ReservationStatus,
  ownerId: string,
): Promise<{ deductionDelta: number }> {
  const supabase = getSupabaseClient()

  // 1. Fetch current reservation (session_id 포함 — owner 격리 확인용)
  const { data: current, error: fetchError } = await supabase
    .from('group_reservations')
    .select('id, session_id, pass_id, status, deducted')
    .eq('id', reservationId)
    .single()
  if (fetchError || !current) throw new Error(`Reservation fetch failed: ${fetchError?.message ?? 'not found'}`)

  // owner 격리: 이 예약의 부모 세션이 owner 것인지 확인 (남의 예약 상태·회차 변조 방지)
  if (ownerId !== 'no-auth') {
    const sessionId = (current as { session_id: number }).session_id
    const { data: sess } = await supabase
      .from('group_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('owner_id', ownerId)
      .maybeSingle()
    if (!sess) throw new Error('권한이 없는 예약입니다.')
  }

  const currentDeducted = (current as { deducted: boolean }).deducted
  const targetDeducts = reservationDeducts(newStatus)

  let delta = 0
  if (!currentDeducted && targetDeducts) delta = -1
  if (currentDeducted && !targetDeducts) delta = +1

  const passId = (current as { pass_id: number | null }).pass_id

  // 2. Update pass.remaining_count if linked + delta != 0 (owner 격리)
  if (passId && delta !== 0) {
    let pq = supabase.from('passes').select('remaining_count, status').eq('id', passId)
    if (ownerId !== 'no-auth') pq = pq.eq('owner_id', ownerId)
    const { data: pass } = await pq.single()
    if (pass) {
      const cur = (pass as { remaining_count: number | null }).remaining_count ?? 0
      const newRemaining = Math.max(0, cur + delta)
      const passStatus = (pass as { status: string | null }).status
      const updates: Record<string, unknown> = {
        remaining_count: newRemaining,
        last_modified_at: new Date().toISOString().slice(0, 10),
      }
      if (newRemaining === 0 && passStatus === '이용중') updates.status = '이용만료'
      if (newRemaining > 0 && passStatus === '이용만료' && delta > 0) updates.status = '이용중'
      let uq = supabase.from('passes').update(updates).eq('id', passId)
      if (ownerId !== 'no-auth') uq = uq.eq('owner_id', ownerId)
      await uq
    }
  }

  // 3. Update reservation
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    deducted: targetDeducts,
  }
  if (newStatus === 'cancelled') {
    updatePayload.cancelled_at = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from('group_reservations')
    .update(updatePayload)
    .eq('id', reservationId)
  if (updateError) throw new Error(`Update reservation failed: ${updateError.message}`)

  return { deductionDelta: delta }
}
