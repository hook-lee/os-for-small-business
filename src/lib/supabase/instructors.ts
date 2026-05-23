import { getSupabaseClient } from './client'

export interface Instructor {
  id: number
  name: string
  phone: string | null
  role: 'owner' | 'instructor' | 'admin'
  employmentType: string | null
  defaultHourlyRate: number
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
  if (patch.color !== undefined) dbPatch.color = patch.color
  if (patch.active !== undefined) dbPatch.active = patch.active

  const { error } = await supabase.from('instructors').update(dbPatch).eq('id', id)
  if (error) throw new Error(`Supabase instructor update failed: ${error.message}`)
}
