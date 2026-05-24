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

export async function fetchReservationsBySession(sessionId: number): Promise<Reservation[]> {
  try {
    const supabase = getSupabaseClient()
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
}): Promise<number> {
  const supabase = getSupabaseClient()

  // Check capacity
  const { data: sessionData, error: sessionError } = await supabase
    .from('group_sessions')
    .select('capacity')
    .eq('id', sessionId)
    .single()
  if (sessionError || !sessionData) throw new Error('세션을 찾을 수 없습니다.')
  const capacity = (sessionData as { capacity: number }).capacity

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
  newStatus: ReservationStatus
): Promise<{ deductionDelta: number }> {
  const supabase = getSupabaseClient()

  // 1. Fetch current reservation
  const { data: current, error: fetchError } = await supabase
    .from('group_reservations')
    .select('id, pass_id, status, deducted')
    .eq('id', reservationId)
    .single()
  if (fetchError || !current) throw new Error(`Reservation fetch failed: ${fetchError?.message ?? 'not found'}`)

  const currentDeducted = (current as { deducted: boolean }).deducted
  const targetDeducts = reservationDeducts(newStatus)

  let delta = 0
  if (!currentDeducted && targetDeducts) delta = -1
  if (currentDeducted && !targetDeducts) delta = +1

  const passId = (current as { pass_id: number | null }).pass_id

  // 2. Update pass.remaining_count if linked + delta != 0
  if (passId && delta !== 0) {
    const { data: pass } = await supabase
      .from('passes')
      .select('remaining_count, status')
      .eq('id', passId)
      .single()
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
      await supabase.from('passes').update(updates).eq('id', passId)
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
