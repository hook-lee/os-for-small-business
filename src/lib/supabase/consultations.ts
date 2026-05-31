import { getSupabaseClient } from './client'

/**
 * 상담 (consultations) — 신규/잠재 회원 상담 기록.
 *
 * owner_id 격리. RLS 정책 적용.
 * 회원 전환 시 member_id 설정 + converted_to_member=true.
 */

export interface Consultation {
  id: number
  memberId: number | null
  name: string
  phone: string | null
  consultationDate: string       // YYYY-MM-DD
  inflowChannel: string | null   // '방문상담' / '전화' / '카톡' 등
  content: string | null
  staffName: string | null
  staffId: number | null
  convertedToMember: boolean
  memo: string | null
  createdAt: string
}

interface ConsultationRow {
  id: number
  member_id: number | null
  name: string
  phone: string | null
  consultation_date: string
  inflow_channel: string | null
  content: string | null
  staff_name: string | null
  staff_id: number | null
  converted_to_member: boolean
  memo: string | null
  created_at: string
}

function rowToConsultation(r: ConsultationRow): Consultation {
  return {
    id: r.id,
    memberId: r.member_id,
    name: r.name,
    phone: r.phone,
    consultationDate: r.consultation_date,
    inflowChannel: r.inflow_channel,
    content: r.content,
    staffName: r.staff_name,
    staffId: r.staff_id,
    convertedToMember: r.converted_to_member,
    memo: r.memo,
    createdAt: r.created_at,
  }
}

export async function fetchAllConsultations(ownerId: string): Promise<Consultation[]> {
  const supabase = getSupabaseClient()
  let q = supabase
    .from('consultations')
    .select('*')
    .order('consultation_date', { ascending: false })
    .order('id', { ascending: false })
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) throw new Error(`Consultations fetch failed: ${error.message}`)
  return ((data ?? []) as ConsultationRow[]).map(rowToConsultation)
}

export async function fetchConsultationsByMember(memberId: number, ownerId: string): Promise<Consultation[]> {
  const supabase = getSupabaseClient()
  let q = supabase
    .from('consultations')
    .select('*')
    .eq('member_id', memberId)
    .order('consultation_date', { ascending: false })
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) throw new Error(`Consultations by member fetch failed: ${error.message}`)
  return ((data ?? []) as ConsultationRow[]).map(rowToConsultation)
}

export interface CreateConsultationInput {
  name: string
  phone?: string | null
  consultationDate: string
  inflowChannel?: string | null
  content?: string | null
  staffName?: string | null
  staffId?: number | null
  memo?: string | null
}

export async function createConsultation(input: CreateConsultationInput, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {
    name: input.name,
    phone: input.phone ?? null,
    consultation_date: input.consultationDate,
    inflow_channel: input.inflowChannel ?? null,
    content: input.content ?? null,
    staff_name: input.staffName ?? null,
    staff_id: input.staffId ?? null,
    memo: input.memo ?? null,
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase
    .from('consultations')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`Create consultation failed: ${error.message}`)
  return (data as { id: number }).id
}

export interface UpdateConsultationInput {
  name?: string
  phone?: string | null
  consultationDate?: string
  inflowChannel?: string | null
  content?: string | null
  staffName?: string | null
  staffId?: number | null
  memberId?: number | null
  convertedToMember?: boolean
  memo?: string | null
}

export async function updateConsultation(id: number, patch: UpdateConsultationInput, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.phone !== undefined) dbPatch.phone = patch.phone
  if (patch.consultationDate !== undefined) dbPatch.consultation_date = patch.consultationDate
  if (patch.inflowChannel !== undefined) dbPatch.inflow_channel = patch.inflowChannel
  if (patch.content !== undefined) dbPatch.content = patch.content
  if (patch.staffName !== undefined) dbPatch.staff_name = patch.staffName
  if (patch.staffId !== undefined) dbPatch.staff_id = patch.staffId
  if (patch.memberId !== undefined) dbPatch.member_id = patch.memberId
  if (patch.convertedToMember !== undefined) dbPatch.converted_to_member = patch.convertedToMember
  if (patch.memo !== undefined) dbPatch.memo = patch.memo
  if (Object.keys(dbPatch).length === 0) return

  let q = supabase.from('consultations').update(dbPatch).eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Update consultation failed: ${error.message}`)
}

export async function deleteConsultation(id: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  let q = supabase.from('consultations').delete().eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Delete consultation failed: ${error.message}`)
}

/**
 * 상담 → 회원 전환.
 * 1) members 테이블에 insert (name + phone)
 * 2) 해당 consultation의 member_id = 새 member.id + converted_to_member=true
 *
 * 트랜잭션은 일반 supabase에선 직접 못 거니 best-effort.
 * 회원 이미 존재(phone 매칭)하면 기존 회원과 연결.
 */
export async function convertConsultationToMember(
  consultationId: number,
  ownerId: string,
): Promise<{ memberId: number; created: boolean }> {
  const supabase = getSupabaseClient()
  // 1. 상담 조회
  let cq = supabase.from('consultations').select('id, name, phone, member_id').eq('id', consultationId)
  if (ownerId !== 'no-auth') cq = cq.eq('owner_id', ownerId)
  const { data: cdata, error: cerr } = await cq.maybeSingle()
  if (cerr || !cdata) throw new Error('상담을 찾을 수 없음')
  const c = cdata as { id: number; name: string; phone: string | null; member_id: number | null }
  if (c.member_id) return { memberId: c.member_id, created: false }

  // 2. 회원 phone으로 lookup (있으면 매칭)
  let memberId: number | null = null
  if (c.phone) {
    let mq = supabase.from('members').select('id').eq('phone', c.phone).limit(1)
    if (ownerId !== 'no-auth') mq = mq.eq('owner_id', ownerId)
    const { data: mdata } = await mq.maybeSingle()
    if (mdata) memberId = (mdata as { id: number }).id
  }

  let created = false
  if (!memberId) {
    // 3. 새 회원 생성
    const row: Record<string, unknown> = {
      name: c.name,
      phone: c.phone,
      registered_at: new Date().toISOString().slice(0, 10),
    }
    if (ownerId !== 'no-auth') row.owner_id = ownerId
    const { data: ndata, error: nerr } = await supabase
      .from('members')
      .insert(row)
      .select('id')
      .single()
    if (nerr) throw new Error(`회원 생성 실패: ${nerr.message}`)
    memberId = (ndata as { id: number }).id
    created = true
  }

  // 4. consultation 업데이트
  await updateConsultation(consultationId, { memberId, convertedToMember: true }, ownerId)
  return { memberId, created }
}
