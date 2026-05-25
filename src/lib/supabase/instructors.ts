import { getSupabaseClient } from './client'

export interface Instructor {
  id: number
  name: string
  phone: string | null
  role: 'owner' | 'instructor' | 'admin'
  employmentType: string | null
  defaultHourlyRate: number  // fallback
  ratePrivate: number
  rateRehab: number
  rateDuet: number
  rateGroup: number
  color: string | null
  active: boolean
}

interface InstructorRow {
  id: number
  name: string
  phone: string | null
  role: string
  employment_type: string | null
  default_hourly_rate: number
  rate_private: number
  rate_rehab: number
  rate_duet: number
  rate_group: number
  color: string | null
  active: boolean
}

function rowToInstructor(row: InstructorRow): Instructor {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role as 'owner' | 'instructor' | 'admin',
    employmentType: row.employment_type,
    defaultHourlyRate: Number(row.default_hourly_rate),
    ratePrivate: Number(row.rate_private),
    rateRehab: Number(row.rate_rehab),
    rateDuet: Number(row.rate_duet),
    rateGroup: Number(row.rate_group),
    color: row.color,
    active: row.active,
  }
}

export async function fetchAllInstructors(ownerId: string): Promise<Instructor[]> {
  const supabase = getSupabaseClient()
  let q = supabase
    .from('instructors')
    .select('*')
    .eq('active', true)
    .order('id', { ascending: true })
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) throw new Error(`Supabase instructors fetch failed: ${error.message}`)
  return ((data ?? []) as InstructorRow[]).map(rowToInstructor)
}

export interface InstructorUpdate {
  name?: string
  phone?: string | null
  role?: 'owner' | 'instructor' | 'admin'
  employmentType?: string | null
  defaultHourlyRate?: number
  ratePrivate?: number
  rateRehab?: number
  rateDuet?: number
  rateGroup?: number
  color?: string | null
  active?: boolean
}

export async function updateInstructor(id: number, patch: InstructorUpdate, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.phone !== undefined) dbPatch.phone = patch.phone
  if (patch.role !== undefined) dbPatch.role = patch.role
  if (patch.employmentType !== undefined) dbPatch.employment_type = patch.employmentType
  if (patch.defaultHourlyRate !== undefined) dbPatch.default_hourly_rate = patch.defaultHourlyRate
  if (patch.ratePrivate !== undefined) dbPatch.rate_private = patch.ratePrivate
  if (patch.rateRehab !== undefined) dbPatch.rate_rehab = patch.rateRehab
  if (patch.rateDuet !== undefined) dbPatch.rate_duet = patch.rateDuet
  if (patch.rateGroup !== undefined) dbPatch.rate_group = patch.rateGroup
  if (patch.color !== undefined) dbPatch.color = patch.color
  if (patch.active !== undefined) dbPatch.active = patch.active

  let q = supabase.from('instructors').update(dbPatch).eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Supabase instructor update failed: ${error.message}`)
}

export interface NewInstructorInput {
  name: string
  phone: string | null
  role: 'owner' | 'instructor' | 'admin'
  defaultHourlyRate?: number
  ratePrivate?: number
  rateRehab?: number
  rateDuet?: number
  rateGroup?: number
  color?: string | null
}

export async function insertInstructor(input: NewInstructorInput, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {
    name: input.name,
    phone: input.phone,
    role: input.role,
    default_hourly_rate: input.defaultHourlyRate ?? 30000,
    rate_private: input.ratePrivate ?? 30000,
    rate_rehab: input.rateRehab ?? 30000,
    rate_duet: input.rateDuet ?? 30000,
    rate_group: input.rateGroup ?? 30000,
    color: input.color ?? null,
    active: true,
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase
    .from('instructors')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`Insert instructor failed: ${error.message}`)
  return (data as { id: number }).id
}

export async function deleteInstructor(id: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  let q = supabase.from('instructors').delete().eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Delete instructor failed: ${error.message}`)
}

export async function fetchInstructorById(id: number, ownerId: string): Promise<Instructor | null> {
  const supabase = getSupabaseClient()
  let q = supabase.from('instructors').select('*').eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(`Fetch instructor failed: ${error.message}`)
  return data ? rowToInstructor(data as InstructorRow) : null
}

// 강사가 담당하는 회원들 (passes 통해)
export async function fetchMembersByInstructor(instructorId: number, ownerId: string): Promise<Array<{
  memberId: number
  memberName: string
  memberPhone: string | null
  passCount: number          // 이 강사 밑에서 산 수강권 개수
  latestPassName: string | null
  latestPassStatus: string | null
}>> {
  const supabase = getSupabaseClient()
  // passes에서 instructor_id로 필터, member join. owner_id로 한 번 더 격리.
  let q = supabase
    .from('passes')
    .select('member_id, pass_name, status, paid_at, members(id, name, phone)')
    .eq('instructor_id', instructorId)
    .order('paid_at', { ascending: false, nullsFirst: false })
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) throw new Error(`Fetch instructor members failed: ${error.message}`)

  // 회원별 그룹화 + 카운트
  const map = new Map<number, {
    memberId: number; memberName: string; memberPhone: string | null;
    passCount: number; latestPassName: string | null; latestPassStatus: string | null;
  }>()
  for (const row of (data ?? []) as Array<{
    member_id: number; pass_name: string; status: string | null; paid_at: string | null;
    members: { id: number; name: string; phone: string | null } | { id: number; name: string; phone: string | null }[] | null;
  }>) {
    // Supabase 1:1 join은 객체로 옴; 단 array로 올 수도 있어서 둘 다 처리
    const member = Array.isArray(row.members) ? row.members[0] : row.members
    if (!member) continue
    const existing = map.get(member.id)
    if (existing) {
      existing.passCount++
    } else {
      map.set(member.id, {
        memberId: member.id,
        memberName: member.name,
        memberPhone: member.phone,
        passCount: 1,
        latestPassName: row.pass_name,
        latestPassStatus: row.status,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.memberName.localeCompare(b.memberName))
}

export async function countMembersByInstructor(instructorId: number, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  let q = supabase
    .from('passes')
    .select('member_id')
    .eq('instructor_id', instructorId)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) return 0
  const unique = new Set((data ?? []).map(r => (r as { member_id: number }).member_id))
  return unique.size
}
