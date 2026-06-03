import { getSupabaseClient } from './client'

export interface MemberInstructorRate {
  id: number
  memberId: number
  instructorId: number
  customRate: number | null          // null = 강사 기본 시급 사용
  incentivePerSession: number        // 회당 추가 인센티브 (원)
  memo: string | null
}

interface MemberInstructorRateRow {
  id: number
  member_id: number
  instructor_id: number
  custom_rate: number | null
  incentive_per_session: number
  memo: string | null
}

function rowToRate(row: MemberInstructorRateRow): MemberInstructorRate {
  return {
    id: row.id,
    memberId: row.member_id,
    instructorId: row.instructor_id,
    customRate: row.custom_rate != null ? Number(row.custom_rate) : null,
    incentivePerSession: Number(row.incentive_per_session ?? 0),
    memo: row.memo,
  }
}

/** 한 회원의 모든 강사별 시급/인센티브 설정 */
export async function fetchRatesByMember(memberId: number, ownerId: string): Promise<MemberInstructorRate[]> {
  try {
    const supabase = getSupabaseClient()
    let q = supabase
      .from('member_instructor_rates')
      .select('*')
      .eq('member_id', memberId)
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error) return []
    return ((data ?? []) as MemberInstructorRateRow[]).map(rowToRate)
  } catch {
    return []
  }
}

/**
 * 한 강사의 회원별 시급/인센티브 맵 (급여 정산용).
 * 반환: Map<memberId, { customRate, incentivePerSession }>
 */
export async function fetchRateMapByInstructor(
  instructorId: number,
  ownerId: string,
): Promise<Map<number, { customRate: number | null; incentivePerSession: number }>> {
  const map = new Map<number, { customRate: number | null; incentivePerSession: number }>()
  try {
    const supabase = getSupabaseClient()
    let q = supabase
      .from('member_instructor_rates')
      .select('member_id, custom_rate, incentive_per_session')
      .eq('instructor_id', instructorId)
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error) return map
    for (const row of (data ?? []) as Array<{ member_id: number; custom_rate: number | null; incentive_per_session: number }>) {
      map.set(row.member_id, {
        customRate: row.custom_rate != null ? Number(row.custom_rate) : null,
        incentivePerSession: Number(row.incentive_per_session ?? 0),
      })
    }
    return map
  } catch {
    return map
  }
}

/**
 * 전 강사의 시급/인센티브 설정 전체 (강사 성과 비교 페이지용).
 * 강사별 1쿼리(fetchRateMapByInstructor) 대신 1쿼리로 받아 호출부에서 그룹화.
 */
export async function fetchAllRates(ownerId: string): Promise<MemberInstructorRate[]> {
  try {
    const supabase = getSupabaseClient()
    let q = supabase.from('member_instructor_rates').select('*')
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error) return []
    return ((data ?? []) as MemberInstructorRateRow[]).map(rowToRate)
  } catch {
    return []
  }
}

export interface UpsertMemberInstructorRateInput {
  memberId: number
  instructorId: number
  customRate: number | null
  incentivePerSession: number
  memo?: string | null
}

export async function upsertMemberInstructorRate(input: UpsertMemberInstructorRateInput, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {
    member_id: input.memberId,
    instructor_id: input.instructorId,
    custom_rate: input.customRate,
    incentive_per_session: input.incentivePerSession,
    memo: input.memo ?? null,
    updated_at: new Date().toISOString(),
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { error } = await supabase
    .from('member_instructor_rates')
    .upsert(row, { onConflict: 'member_id,instructor_id' })
  if (error) throw new Error(`Upsert member instructor rate failed: ${error.message}`)
}

/** (회원, 강사) 시급 설정 삭제 = 강사 기본 시급으로 복귀 */
export async function deleteMemberInstructorRate(memberId: number, instructorId: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  let q = supabase
    .from('member_instructor_rates')
    .delete()
    .eq('member_id', memberId)
    .eq('instructor_id', instructorId)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Delete member instructor rate failed: ${error.message}`)
}
