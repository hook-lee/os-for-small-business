import { getSupabaseClient } from './client'

export interface PassProduct {
  id: number
  name: string
  passType: '프라이빗' | '그룹'
  durationDays: number
  totalCount: number
  price: number
  perUnitPrice: number | null
  displayOrder: number
  color: string | null
  active: boolean
}

interface PassProductRow {
  id: number
  name: string
  pass_type: string
  duration_days: number
  total_count: number
  price: number
  per_unit_price: number | null
  display_order: number
  color: string | null
  active: boolean
}

function rowToProduct(row: PassProductRow): PassProduct {
  return {
    id: row.id,
    name: row.name,
    passType: row.pass_type as '프라이빗' | '그룹',
    durationDays: row.duration_days,
    totalCount: row.total_count,
    price: Number(row.price),
    perUnitPrice: row.per_unit_price ? Number(row.per_unit_price) : null,
    displayOrder: row.display_order,
    color: row.color,
    active: row.active,
  }
}

export async function fetchAllPassProducts(): Promise<PassProduct[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('pass_products')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true })
    if (error) return []  // table not yet created → empty
    return ((data ?? []) as PassProductRow[]).map(rowToProduct)
  } catch {
    return []
  }
}

export async function fetchPassProductById(id: number): Promise<PassProduct | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('pass_products').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return rowToProduct(data as PassProductRow)
}

export interface NewPassProductInput {
  name: string
  passType: '프라이빗' | '그룹'
  durationDays: number
  totalCount: number
  price: number
  perUnitPrice?: number | null
  displayOrder?: number
  color?: string | null
}

export interface UpdatePassProductInput {
  name?: string
  passType?: '프라이빗' | '그룹'
  durationDays?: number
  totalCount?: number
  price?: number
  perUnitPrice?: number | null
  displayOrder?: number
  color?: string | null
  active?: boolean
}

export async function insertPassProduct(input: NewPassProductInput): Promise<number> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pass_products')
    .insert({
      name: input.name,
      pass_type: input.passType,
      duration_days: input.durationDays,
      total_count: input.totalCount,
      price: input.price,
      per_unit_price: input.perUnitPrice ?? null,
      display_order: input.displayOrder ?? 0,
      color: input.color ?? null,
      active: true,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Insert pass product failed: ${error.message}`)
  return (data as { id: number }).id
}

export async function updatePassProduct(id: number, patch: UpdatePassProductInput): Promise<void> {
  const supabase = getSupabaseClient()
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.passType !== undefined) dbPatch.pass_type = patch.passType
  if (patch.durationDays !== undefined) dbPatch.duration_days = patch.durationDays
  if (patch.totalCount !== undefined) dbPatch.total_count = patch.totalCount
  if (patch.price !== undefined) dbPatch.price = patch.price
  if (patch.perUnitPrice !== undefined) dbPatch.per_unit_price = patch.perUnitPrice
  if (patch.displayOrder !== undefined) dbPatch.display_order = patch.displayOrder
  if (patch.color !== undefined) dbPatch.color = patch.color
  if (patch.active !== undefined) dbPatch.active = patch.active

  const { error } = await supabase.from('pass_products').update(dbPatch).eq('id', id)
  if (error) throw new Error(`Update pass product failed: ${error.message}`)
}

export async function deletePassProduct(id: number): Promise<void> {
  // Hard delete; passes referencing it have no FK so they keep their snapshot fields.
  // 만약 active=false로 soft delete를 원하면 updatePassProduct({active:false})를 사용.
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('pass_products').delete().eq('id', id)
  if (error) throw new Error(`Delete pass product failed: ${error.message}`)
}
