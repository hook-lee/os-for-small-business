import { getSupabaseClient } from './client'

export interface Member {
  id: number
  name: string
  phone: string | null
  email: string | null
  gender: string | null
  birthDate: string | null
  address: string | null
  detailAddress: string | null
  memo: string | null
  internalMemo: string | null
  tier: string | null
  appConnected: boolean
  registeredAt: string | null
  lastAttendedAt: string | null
  accessToken?: string | null
  ownerId?: string | null
}

interface MemberRow {
  id: number
  name: string
  phone: string | null
  email: string | null
  gender: string | null
  birth_date: string | null
  address: string | null
  detail_address: string | null
  memo: string | null
  internal_memo: string | null
  tier: string | null
  app_connected: boolean
  registered_at: string | null
  last_attended_at: string | null
  access_token: string | null
  owner_id?: string | null
}

function rowToMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    gender: row.gender,
    birthDate: row.birth_date,
    address: row.address,
    detailAddress: row.detail_address,
    memo: row.memo,
    internalMemo: row.internal_memo,
    tier: row.tier,
    appConnected: row.app_connected,
    registeredAt: row.registered_at,
    lastAttendedAt: row.last_attended_at,
    accessToken: row.access_token ?? null,
    ownerId: row.owner_id ?? null,
  }
}

export async function fetchAllMembers(ownerId: string): Promise<Member[]> {
  const supabase = getSupabaseClient()
  const PAGE = 1000
  const all: MemberRow[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('members')
      .select('*')
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1)
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error) throw new Error(`Supabase members fetch failed: ${error.message}`)
    const rows = (data ?? []) as MemberRow[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all.map(rowToMember)
}

export async function fetchMemberById(id: number, ownerId: string): Promise<Member | null> {
  const supabase = getSupabaseClient()
  let q = supabase.from('members').select('*').eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(`Supabase member fetch failed: ${error.message}`)
  return data ? rowToMember(data as MemberRow) : null
}

export interface NewMemberInput {
  name: string
  phone?: string | null
  email?: string | null
  gender?: string | null
  birthDate?: string | null
  address?: string | null
  detailAddress?: string | null
  memo?: string | null
  tier?: string | null
  appConnected?: boolean
}

export async function insertMember(input: NewMemberInput, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {
    name: input.name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    gender: input.gender ?? null,
    birth_date: input.birthDate ?? null,
    address: input.address ?? null,
    detail_address: input.detailAddress ?? null,
    memo: input.memo ?? null,
    tier: input.tier ?? null,
    app_connected: input.appConnected ?? false,
    registered_at: new Date().toISOString().slice(0, 10),
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase
    .from('members')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`Insert member failed: ${error.message}`)
  return (data as { id: number }).id
}

export async function deleteMember(id: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  let q = supabase.from('members').delete().eq('id', id)  // passes는 ON DELETE CASCADE
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Delete member failed: ${error.message}`)
}

export interface MemberUpdate {
  name?: string
  phone?: string | null
  email?: string | null
  gender?: string | null
  birthDate?: string | null
  address?: string | null
  detailAddress?: string | null
  memo?: string | null
  internalMemo?: string | null
  tier?: string | null
}

export async function updateMember(id: number, patch: MemberUpdate, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.phone !== undefined) dbPatch.phone = patch.phone
  if (patch.email !== undefined) dbPatch.email = patch.email
  if (patch.gender !== undefined) dbPatch.gender = patch.gender
  if (patch.birthDate !== undefined) dbPatch.birth_date = patch.birthDate
  if (patch.address !== undefined) dbPatch.address = patch.address
  if (patch.detailAddress !== undefined) dbPatch.detail_address = patch.detailAddress
  if (patch.memo !== undefined) dbPatch.memo = patch.memo
  if (patch.internalMemo !== undefined) dbPatch.internal_memo = patch.internalMemo
  if (patch.tier !== undefined) dbPatch.tier = patch.tier
  let q = supabase.from('members').update(dbPatch).eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Update member failed: ${error.message}`)
}

/**
 * 회원 access_token 재발급. owner_id 필터로 본인 회원만 토큰 갱신 가능.
 */
export async function regenerateAccessToken(memberId: number, ownerId: string): Promise<string> {
  const token = crypto.randomUUID()
  const supabase = getSupabaseClient()
  let q = supabase.from('members').update({ access_token: token }).eq('id', memberId)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Token regen failed: ${error.message}`)
  return token
}

/**
 * 회원 토큰으로 회원 조회. owner_id 필터 X — 회원은 토큰만으로 본인 페이지 접근.
 * token은 글로벌 unique.
 */
export async function fetchMemberByToken(token: string): Promise<Member | null> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('access_token', token)
      .maybeSingle()
    if (error || !data) return null
    return rowToMember(data as MemberRow)
  } catch { return null }
}
