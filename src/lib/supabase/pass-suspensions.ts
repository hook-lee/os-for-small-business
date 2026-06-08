import { getSupabaseClient } from './client'
import { inclusiveDays, addDays, totalSuspendDays, type Suspension } from '@/lib/analytics/suspensions'

/**
 * 수강권 정지(일시정지) DB 처리. 멀티테넌트 owner_id 격리.
 *  - createSuspension: 누적 한도 체크 → 이력 insert → passes.end_date += days.
 *  - deleteSuspension: 이력 삭제 → passes.end_date −= days (연장 되돌림).
 */

interface SuspensionRow {
  id: number
  pass_id: number
  start_date: string
  end_date: string
  days: number
  reason: string | null
  created_at: string
}

function rowToSuspension(r: SuspensionRow): Suspension {
  return {
    id: r.id,
    passId: r.pass_id,
    startDate: r.start_date,
    endDate: r.end_date,
    days: r.days,
    reason: r.reason,
    createdAt: r.created_at,
  }
}

/** 한 수강권의 정지 이력 (최신순). 테이블 미존재(마이그 전)면 빈 배열. */
export async function fetchSuspensionsByPass(passId: number, ownerId: string): Promise<Suspension[]> {
  const supabase = getSupabaseClient()
  try {
    let q = supabase.from('pass_suspensions').select('*').eq('pass_id', passId).order('start_date', { ascending: false })
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error || !data) return []
    return (data as SuspensionRow[]).map(rowToSuspension)
  } catch {
    return []
  }
}

/** 여러 수강권의 정지 이력을 한 번에 (회원 상세에서 패스별 그룹). */
export async function fetchSuspensionsByPassIds(passIds: number[], ownerId: string): Promise<Map<number, Suspension[]>> {
  const map = new Map<number, Suspension[]>()
  if (passIds.length === 0) return map
  const supabase = getSupabaseClient()
  try {
    let q = supabase.from('pass_suspensions').select('*').in('pass_id', passIds).order('start_date', { ascending: false })
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error || !data) return map
    for (const r of data as SuspensionRow[]) {
      const s = rowToSuspension(r)
      const arr = map.get(s.passId) ?? []
      arr.push(s)
      map.set(s.passId, arr)
    }
  } catch {
    /* 테이블 미존재 → 빈 맵 */
  }
  return map
}

export interface NewSuspension {
  passId: number
  startDate: string
  endDate: string
  reason?: string | null
}

/**
 * 정지 등록. maxDays(센터 최대 누적, 0=무제한) 초과 시 에러.
 * 성공 시 passes.end_date를 정지 일수만큼 연장.
 */
export async function createSuspension(
  input: NewSuspension,
  ownerId: string,
  maxDays: number,
): Promise<{ id: number; days: number; newEndDate: string | null }> {
  const supabase = getSupabaseClient()
  const days = inclusiveDays(input.startDate, input.endDate)
  if (days <= 0) throw new Error('종료일이 시작일보다 빨라요')

  // 만료일 + 이 수강권의 최대 정지일수 조회. 상품별 한도(passes.max_suspend_days)가 있으면 우선,
  // 없으면 센터 기본(maxDays). (select('*') → 마이그 전 컬럼 없어도 안전)
  let pq = supabase.from('passes').select('*').eq('id', input.passId)
  if (ownerId !== 'no-auth') pq = pq.eq('owner_id', ownerId)
  const { data: passRow } = await pq.maybeSingle()
  const pr = passRow as { end_date: string | null; max_suspend_days?: number | null } | null
  const curEnd = pr?.end_date ?? null
  const effectiveMax = pr?.max_suspend_days ?? maxDays

  const existing = await fetchSuspensionsByPass(input.passId, ownerId)
  const used = totalSuspendDays(existing)
  if (effectiveMax > 0 && used + days > effectiveMax) {
    throw new Error(`최대 정지일수(${effectiveMax}일)를 넘어요. 이미 ${used}일 사용 → 최대 ${Math.max(0, effectiveMax - used)}일까지 가능`)
  }

  const row: Record<string, unknown> = {
    pass_id: input.passId,
    start_date: input.startDate,
    end_date: input.endDate,
    days,
    reason: input.reason?.trim() || null,
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data: created, error } = await supabase.from('pass_suspensions').insert(row).select('id').single()
  if (error) throw new Error(`정지 등록 실패: ${error.message}`)
  const id = (created as { id: number }).id

  // 만료일 연장
  let newEndDate: string | null = curEnd
  if (curEnd) {
    newEndDate = addDays(curEnd, days)
    let uq = supabase.from('passes').update({ end_date: newEndDate }).eq('id', input.passId)
    if (ownerId !== 'no-auth') uq = uq.eq('owner_id', ownerId)
    await uq
  }
  return { id, days, newEndDate }
}

/** 정지 이력 삭제 + 만료일 연장 되돌림(−days). */
export async function deleteSuspension(id: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  // 삭제 전 정보 조회 (days, pass_id)
  let sq = supabase.from('pass_suspensions').select('pass_id, days').eq('id', id)
  if (ownerId !== 'no-auth') sq = sq.eq('owner_id', ownerId)
  const { data: sRow } = await sq.maybeSingle()
  const info = sRow as { pass_id: number; days: number } | null

  let dq = supabase.from('pass_suspensions').delete().eq('id', id)
  if (ownerId !== 'no-auth') dq = dq.eq('owner_id', ownerId)
  const { error } = await dq
  if (error) throw new Error(`정지 삭제 실패: ${error.message}`)

  // 만료일 되돌림
  if (info) {
    let pq = supabase.from('passes').select('end_date').eq('id', info.pass_id)
    if (ownerId !== 'no-auth') pq = pq.eq('owner_id', ownerId)
    const { data: passRow } = await pq.maybeSingle()
    const curEnd = (passRow as { end_date: string | null } | null)?.end_date ?? null
    if (curEnd) {
      let uq = supabase.from('passes').update({ end_date: addDays(curEnd, -info.days) }).eq('id', info.pass_id)
      if (ownerId !== 'no-auth') uq = uq.eq('owner_id', ownerId)
      await uq
    }
  }
}
