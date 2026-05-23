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

export async function fetchAllInstructors(): Promise<Instructor[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('instructors')
    .select('*')
    .eq('active', true)
    .order('id', { ascending: true })
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

export async function updateInstructor(id: number, patch: InstructorUpdate): Promise<void> {
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

  const { error } = await supabase.from('instructors').update(dbPatch).eq('id', id)
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

export async function insertInstructor(input: NewInstructorInput): Promise<number> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('instructors')
    .insert({
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
    })
    .select('id')
    .single()
  if (error) throw new Error(`Insert instructor failed: ${error.message}`)
  return (data as { id: number }).id
}

export async function deleteInstructor(id: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('instructors').delete().eq('id', id)
  if (error) throw new Error(`Delete instructor failed: ${error.message}`)
}
