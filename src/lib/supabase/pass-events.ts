import { getSupabaseClient } from './client'

/**
 * 수강권 변경 audit log (pass_events).
 *
 * 1차 구현은 read + import. 앱 내 자동 기록(trigger 또는 lib-level write)은 V2.
 *
 * event_type:
 *  - issued    수강권 발급
 *  - modified  회차·기간 등 수정
 *  - expired   자동 만료
 *  - deleted   삭제
 *
 * before_data / after_data:
 *  jsonb. xlsx import한 데이터는 { "전체횟수": "10", "이용시작일": "2026-01-02", ... } 형태.
 */

export type PassEventType = 'issued' | 'modified' | 'expired' | 'deleted'

export interface PassEvent {
  id: number
  passId: number | null
  memberId: number | null
  memberName: string
  passName: string | null
  eventType: PassEventType
  changedAt: string             // timestamptz ISO
  changedBy: string | null
  changedById: number | null
  beforeData: Record<string, string> | null
  afterData: Record<string, string> | null
  source: string
  createdAt: string
}

interface PassEventRow {
  id: number
  pass_id: number | null
  member_id: number | null
  member_name: string
  pass_name: string | null
  event_type: string
  changed_at: string
  changed_by: string | null
  changed_by_id: number | null
  before_data: Record<string, string> | null
  after_data: Record<string, string> | null
  source: string | null
  created_at: string
}

function rowToEvent(r: PassEventRow): PassEvent {
  return {
    id: r.id,
    passId: r.pass_id,
    memberId: r.member_id,
    memberName: r.member_name,
    passName: r.pass_name,
    eventType: r.event_type as PassEventType,
    changedAt: r.changed_at,
    changedBy: r.changed_by,
    changedById: r.changed_by_id,
    beforeData: r.before_data,
    afterData: r.after_data,
    source: r.source ?? 'app',
    createdAt: r.created_at,
  }
}

export async function fetchPassEventsByMember(memberId: number, ownerId: string, limit = 100): Promise<PassEvent[]> {
  const supabase = getSupabaseClient()
  let q = supabase
    .from('pass_events')
    .select('*')
    .eq('member_id', memberId)
    .order('changed_at', { ascending: false })
    .limit(limit)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) throw new Error(`Pass events fetch failed: ${error.message}`)
  return ((data ?? []) as PassEventRow[]).map(rowToEvent)
}

export async function fetchRecentPassEvents(ownerId: string, limit = 50): Promise<PassEvent[]> {
  const supabase = getSupabaseClient()
  let q = supabase
    .from('pass_events')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(limit)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) throw new Error(`Recent pass events fetch failed: ${error.message}`)
  return ((data ?? []) as PassEventRow[]).map(rowToEvent)
}

export interface CreatePassEventInput {
  passId?: number | null
  memberId?: number | null
  memberName: string
  passName?: string | null
  eventType: PassEventType
  changedAt: string
  changedBy?: string | null
  changedById?: number | null
  beforeData?: Record<string, string> | null
  afterData?: Record<string, string> | null
  source?: string
}

export async function createPassEvent(input: CreatePassEventInput, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {
    pass_id: input.passId ?? null,
    member_id: input.memberId ?? null,
    member_name: input.memberName,
    pass_name: input.passName ?? null,
    event_type: input.eventType,
    changed_at: input.changedAt,
    changed_by: input.changedBy ?? null,
    changed_by_id: input.changedById ?? null,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
    source: input.source ?? 'app',
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase
    .from('pass_events')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`Create pass event failed: ${error.message}`)
  return (data as { id: number }).id
}

/**
 * 한국어 이벤트 라벨.
 */
export const PASS_EVENT_LABEL: Record<PassEventType, string> = {
  issued: '발급',
  modified: '변경',
  expired: '만료',
  deleted: '삭제',
}
