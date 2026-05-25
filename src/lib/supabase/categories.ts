import { getSupabaseClient } from './client'

export interface ExpenseCategory {
  id: number
  name: string
  description: string | null
  classification: 'business' | 'living' | 'owner_draw' | 'reserve' | 'capital'
  vatDeductible: boolean
  incomeTaxDeductible: boolean
  displayOrder: number
  active: boolean
  isDefault: boolean
}

interface CategoryRow {
  id: number
  name: string
  description: string | null
  classification: string
  vat_deductible: boolean
  income_tax_deductible: boolean
  display_order: number
  active: boolean
  is_default: boolean
}

function rowToCategory(row: CategoryRow): ExpenseCategory {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    classification: row.classification as ExpenseCategory['classification'],
    vatDeductible: row.vat_deductible,
    incomeTaxDeductible: row.income_tax_deductible,
    displayOrder: row.display_order,
    active: row.active,
    isDefault: row.is_default,
  }
}

/**
 * 카테고리 목록 조회.
 * - is_default=true (시드 24개)는 공용 (owner_id NULL)
 * - 사용자 추가 카테고리는 owner_id 본인 것만
 */
export async function fetchAllCategories(ownerId: string): Promise<ExpenseCategory[]> {
  try {
    const supabase = getSupabaseClient()
    let q = supabase
      .from('expense_categories')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true })
    if (ownerId !== 'no-auth') {
      // owner의 것 OR 공용(is_default=true)
      q = q.or(`owner_id.eq.${ownerId},is_default.eq.true`)
    }
    const { data, error } = await q
    if (error) return []
    return ((data ?? []) as CategoryRow[]).map(rowToCategory)
  } catch { return [] }
}

export interface NewCategoryInput {
  name: string
  description?: string | null
  classification?: 'business' | 'living' | 'owner_draw' | 'reserve' | 'capital'
  vatDeductible?: boolean
  incomeTaxDeductible?: boolean
  displayOrder?: number
}

export async function insertCategory(input: NewCategoryInput, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {
    name: input.name,
    description: input.description ?? null,
    classification: input.classification ?? 'living',
    vat_deductible: input.vatDeductible ?? false,
    income_tax_deductible: input.incomeTaxDeductible ?? false,
    display_order: input.displayOrder ?? 80,
    active: true,
    is_default: false,
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase
    .from('expense_categories')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`Insert category failed: ${error.message}`)
  return (data as { id: number }).id
}

export interface UpdateCategoryInput {
  name?: string
  description?: string | null
  classification?: 'business' | 'living' | 'owner_draw' | 'reserve' | 'capital'
  vatDeductible?: boolean
  incomeTaxDeductible?: boolean
  displayOrder?: number
  active?: boolean
}

export async function updateCategory(id: number, patch: UpdateCategoryInput, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  // 공용 카테고리(is_default=true)는 수정 불가
  const { data: existing } = await supabase
    .from('expense_categories')
    .select('is_default')
    .eq('id', id)
    .maybeSingle()
  if (existing && (existing as { is_default: boolean }).is_default) {
    throw new Error('공용 카테고리는 수정할 수 없습니다')
  }

  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.description !== undefined) dbPatch.description = patch.description
  if (patch.classification !== undefined) dbPatch.classification = patch.classification
  if (patch.vatDeductible !== undefined) dbPatch.vat_deductible = patch.vatDeductible
  if (patch.incomeTaxDeductible !== undefined) dbPatch.income_tax_deductible = patch.incomeTaxDeductible
  if (patch.displayOrder !== undefined) dbPatch.display_order = patch.displayOrder
  if (patch.active !== undefined) dbPatch.active = patch.active
  let q = supabase.from('expense_categories').update(dbPatch).eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Update category failed: ${error.message}`)
}

export async function deleteCategory(id: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  // 공용 카테고리(is_default=true)는 삭제 불가
  const { data: existing } = await supabase
    .from('expense_categories')
    .select('is_default')
    .eq('id', id)
    .maybeSingle()
  if (existing && (existing as { is_default: boolean }).is_default) {
    throw new Error('공용 카테고리는 삭제할 수 없습니다')
  }
  let q = supabase.from('expense_categories').delete().eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Delete category failed: ${error.message}`)
}
