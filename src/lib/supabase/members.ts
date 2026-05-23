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
  tier: string | null
  appConnected: boolean
  registeredAt: string | null
  lastAttendedAt: string | null
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
  tier: string | null
  app_connected: boolean
  registered_at: string | null
  last_attended_at: string | null
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
    tier: row.tier,
    appConnected: row.app_connected,
    registeredAt: row.registered_at,
    lastAttendedAt: row.last_attended_at,
  }
}

export async function fetchAllMembers(): Promise<Member[]> {
  const supabase = getSupabaseClient()
  const PAGE = 1000
  const all: MemberRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Supabase members fetch failed: ${error.message}`)
    const rows = (data ?? []) as MemberRow[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all.map(rowToMember)
}

export async function fetchMemberById(id: number): Promise<Member | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .maybeSingle()
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

export async function insertMember(input: NewMemberInput): Promise<number> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('members')
    .insert({
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
    })
    .select('id')
    .single()
  if (error) throw new Error(`Insert member failed: ${error.message}`)
  return (data as { id: number }).id
}

export async function deleteMember(id: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('members').delete().eq('id', id)  // passes는 ON DELETE CASCADE
  if (error) throw new Error(`Delete member failed: ${error.message}`)
}
