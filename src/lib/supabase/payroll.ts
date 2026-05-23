import { getSupabaseClient } from './client'

export interface PayrollRecord {
  id: number
  instructorId: number
  yearMonth: string  // YYYY-MM
  privateCount: number
  rehabCount: number
  duetCount: number
  groupCount: number
  totalAmount: number
  bonus: number
  deduction: number
  taxWithholding: number
  netAmount: number  // computed: total + bonus - taxWithholding - deduction
  memo: string | null
  paid: boolean
  paidAt: string | null
}

interface PayrollRow {
  id: number
  instructor_id: number
  year_month: string
  private_count: number
  rehab_count: number
  duet_count: number
  group_count: number
  total_amount: number
  bonus: number
  deduction: number
  tax_withholding: number
  memo: string | null
  paid: boolean
  paid_at: string | null
}

function rowToPayroll(row: PayrollRow): PayrollRecord {
  const taxWithholding = Number(row.tax_withholding ?? 0)
  return {
    id: row.id,
    instructorId: row.instructor_id,
    yearMonth: row.year_month,
    privateCount: row.private_count,
    rehabCount: row.rehab_count,
    duetCount: row.duet_count,
    groupCount: row.group_count,
    totalAmount: Number(row.total_amount),
    bonus: Number(row.bonus),
    deduction: Number(row.deduction),
    taxWithholding,
    netAmount: Number(row.total_amount) + Number(row.bonus) - taxWithholding - Number(row.deduction),
    memo: row.memo,
    paid: row.paid,
    paidAt: row.paid_at,
  }
}

export async function fetchPayrollByMonth(yearMonth: string): Promise<PayrollRecord[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('year_month', yearMonth)
    if (error) return []
    return ((data ?? []) as PayrollRow[]).map(rowToPayroll)
  } catch {
    return []
  }
}

export interface UpsertPayrollInput {
  instructorId: number
  yearMonth: string
  privateCount: number
  rehabCount: number
  duetCount: number
  groupCount: number
  totalAmount: number
  bonus?: number
  deduction?: number
  taxWithholding?: number
  memo?: string | null
  paid?: boolean
  paidAt?: string | null
}

export async function upsertPayroll(input: UpsertPayrollInput): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('payroll_records')
    .upsert({
      instructor_id: input.instructorId,
      year_month: input.yearMonth,
      private_count: input.privateCount,
      rehab_count: input.rehabCount,
      duet_count: input.duetCount,
      group_count: input.groupCount,
      total_amount: input.totalAmount,
      bonus: input.bonus ?? 0,
      deduction: input.deduction ?? 0,
      tax_withholding: input.taxWithholding ?? 0,
      memo: input.memo ?? null,
      paid: input.paid ?? false,
      paid_at: input.paidAt ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'instructor_id,year_month' })
  if (error) throw new Error(`Upsert payroll failed: ${error.message}`)
}
