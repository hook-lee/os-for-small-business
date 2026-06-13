import { getSupabaseClient } from './client'

export interface Instructor {
  id: number
  name: string
  phone: string | null
  email: string | null
  role: 'owner' | 'instructor' | 'admin'
  employmentType: string | null
  defaultHourlyRate: number  // fallback (카테고리별 시급 미설정 시)
  ratePrivate: number        // (레거시) 개인 시급 — categoryRates로 이행 중, 미설정 DB 폴백용
  rateRehab: number          // (레거시) 재활 시급
  rateDuet: number           // (레거시) 듀엣 시급
  rateGroup: number          // (레거시) 그룹 시급
  // 카테고리별 시급 (§0) — { '개인': 30000, '요가': 25000, ... }. 센터의 수강권 카테고리에 맞춰 원장이 설정.
  // 비어있으면 effectiveRateMap()이 레거시 4종을 폴백으로 사용.
  categoryRates: Record<string, number>
  color: string | null
  active: boolean
  authUserId: string | null   // 로그인 계정 연결 여부 (v3.17). null=미연결
}

interface InstructorRow {
  id: number
  name: string
  phone: string | null
  email: string | null
  role: string
  employment_type: string | null
  default_hourly_rate: number
  rate_private: number
  rate_rehab: number
  rate_duet: number
  rate_group: number
  category_rates?: Record<string, number> | null
  color: string | null
  active: boolean
  auth_user_id?: string | null
}

function rowToInstructor(row: InstructorRow): Instructor {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? null,
    role: row.role as 'owner' | 'instructor' | 'admin',
    employmentType: row.employment_type,
    defaultHourlyRate: Number(row.default_hourly_rate),
    ratePrivate: Number(row.rate_private),
    rateRehab: Number(row.rate_rehab),
    rateDuet: Number(row.rate_duet),
    rateGroup: Number(row.rate_group),
    categoryRates: (row.category_rates ?? {}) as Record<string, number>,
    color: row.color,
    active: row.active,
    authUserId: row.auth_user_id ?? null,
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
  categoryRates?: Record<string, number>
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
  if (patch.categoryRates !== undefined) dbPatch.category_rates = patch.categoryRates
  if (patch.color !== undefined) dbPatch.color = patch.color
  if (patch.active !== undefined) dbPatch.active = patch.active

  const run = async (p: Record<string, unknown>) => {
    let q = supabase.from('instructors').update(p).eq('id', id)
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    return q
  }
  const { error } = await run(dbPatch)
  if (error) {
    // category_rates 컬럼이 아직 없는 DB(v3.24 전) 폴백: 빼고 재시도.
    if (/category_rates|does not exist|schema cache/i.test(error.message) && dbPatch.category_rates !== undefined) {
      const rest = { ...dbPatch }; delete rest.category_rates
      const retry = await run(rest)
      if (retry.error) throw new Error(`Supabase instructor update failed: ${retry.error.message}`)
      return
    }
    throw new Error(`Supabase instructor update failed: ${error.message}`)
  }
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
  categoryRates?: Record<string, number>
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
    category_rates: input.categoryRates ?? {},
    color: input.color ?? null,
    active: true,
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const ins = async (r: Record<string, unknown>) =>
    supabase.from('instructors').insert(r).select('id').single()
  let { data, error } = await ins(row)
  if (error && /category_rates|does not exist|schema cache/i.test(error.message)) {
    // category_rates 컬럼 없는 DB(v3.24 전) 폴백
    const rest = { ...row }; delete rest.category_rates
    ;({ data, error } = await ins(rest))
  }
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

export interface InstructorMemberRow {
  memberId: number
  memberName: string
  memberPhone: string | null
  passCount: number          // 이 강사 밑에서 산 수강권 개수 (누적)
  latestPassName: string | null
  latestPassStatus: string | null
  isActive: boolean          // 이 강사 밑에서 '이용중' 수강권을 1개 이상 보유
}

// 강사가 담당하는 회원들 (passes 통해)
export async function fetchMembersByInstructor(instructorId: number, ownerId: string): Promise<InstructorMemberRow[]> {
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
  const map = new Map<number, InstructorMemberRow>()
  for (const row of (data ?? []) as Array<{
    member_id: number; pass_name: string; status: string | null; paid_at: string | null;
    members: { id: number; name: string; phone: string | null } | { id: number; name: string; phone: string | null }[] | null;
  }>) {
    // Supabase 1:1 join은 객체로 옴; 단 array로 올 수도 있어서 둘 다 처리
    const member = Array.isArray(row.members) ? row.members[0] : row.members
    if (!member) continue
    const active = row.status === '이용중'
    const existing = map.get(member.id)
    if (existing) {
      existing.passCount++
      if (active) existing.isActive = true
    } else {
      map.set(member.id, {
        memberId: member.id,
        memberName: member.name,
        memberPhone: member.phone,
        passCount: 1,
        latestPassName: row.pass_name,   // paid_at desc 정렬이라 첫 row = 최신
        latestPassStatus: row.status,
        isActive: active,
      })
    }
  }
  // 이용중 회원 먼저, 그 다음 이름순
  return Array.from(map.values()).sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return a.memberName.localeCompare(b.memberName)
  })
}

/**
 * 강사가 현재 담당 중인 회원 수 = 이 강사 밑에서 '이용중' 수강권을 가진 unique 회원.
 * (만료 회원은 제외 — 누적 집계가 아니라 현재 담당 인원을 보여주기 위함)
 */
export async function countMembersByInstructor(instructorId: number, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  let q = supabase
    .from('passes')
    .select('member_id')
    .eq('instructor_id', instructorId)
    .eq('status', '이용중')
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) return 0
  const unique = new Set((data ?? []).map(r => (r as { member_id: number }).member_id))
  return unique.size
}
