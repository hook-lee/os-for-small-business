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

export async function fetchAllCategories(): Promise<ExpenseCategory[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true })
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

export async function insertCategory(input: NewCategoryInput): Promise<number> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({
      name: input.name,
      description: input.description ?? null,
      classification: input.classification ?? 'living',
      vat_deductible: input.vatDeductible ?? false,
      income_tax_deductible: input.incomeTaxDeductible ?? false,
      display_order: input.displayOrder ?? 80,
      active: true,
      is_default: false,
    })
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

export async function updateCategory(id: number, patch: UpdateCategoryInput): Promise<void> {
  const supabase = getSupabaseClient()
  const dbPatch: Record<string, unknown> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.description !== undefined) dbPatch.description = patch.description
  if (patch.classification !== undefined) dbPatch.classification = patch.classification
  if (patch.vatDeductible !== undefined) dbPatch.vat_deductible = patch.vatDeductible
  if (patch.incomeTaxDeductible !== undefined) dbPatch.income_tax_deductible = patch.incomeTaxDeductible
  if (patch.displayOrder !== undefined) dbPatch.display_order = patch.displayOrder
  if (patch.active !== undefined) dbPatch.active = patch.active
  const { error } = await supabase.from('expense_categories').update(dbPatch).eq('id', id)
  if (error) throw new Error(`Update category failed: ${error.message}`)
}

export async function deleteCategory(id: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('expense_categories').delete().eq('id', id)
  if (error) throw new Error(`Delete category failed: ${error.message}`)
}
