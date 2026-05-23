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
