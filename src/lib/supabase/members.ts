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
