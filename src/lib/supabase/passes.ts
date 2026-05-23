import { getSupabaseClient } from './client'

export interface Pass {
  id: number
  memberId: number
  instructorId: number | null
  passName: string
  passType: string | null
  startDate: string | null
  endDate: string | null
  totalCount: number | null
  remainingCount: number | null
  availableCount: number | null
  cancellableCount: number | null
  status: string | null
  paymentType: string | null
  paymentAmount: number | null
  paidAt: string | null
  paymentMethod: string | null
  installment: string | null
  isFamily: boolean
  issuedAt: string | null
  lastModifiedAt: string | null
}

interface PassRow {
  id: number
  member_id: number
  instructor_id: number | null
  pass_name: string
  pass_type: string | null
  start_date: string | null
  end_date: string | null
  total_count: number | null
  remaining_count: number | null
  available_count: number | null
  cancellable_count: number | null
  status: string | null
  payment_type: string | null
  payment_amount: number | null
  paid_at: string | null
  payment_method: string | null
  installment: string | null
  is_family: boolean
  issued_at: string | null
  last_modified_at: string | null
}

function rowToPass(row: PassRow): Pass {
  return {
    id: row.id,
    memberId: row.member_id,
    instructorId: row.instructor_id,
    passName: row.pass_name,
    passType: row.pass_type,
    startDate: row.start_date,
    endDate: row.end_date,
    totalCount: row.total_count,
    remainingCount: row.remaining_count,
    availableCount: row.available_count,
    cancellableCount: row.cancellable_count,
    status: row.status,
    paymentType: row.payment_type,
    paymentAmount: row.payment_amount,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    installment: row.installment,
    isFamily: row.is_family,
    issuedAt: row.issued_at,
    lastModifiedAt: row.last_modified_at,
  }
}

export async function fetchPassesByMember(memberId: number): Promise<Pass[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('passes')
    .select('*')
    .eq('member_id', memberId)
    .order('paid_at', { ascending: false, nullsFirst: false })
  if (error) throw new Error(`Supabase passes fetch failed: ${error.message}`)
  return ((data ?? []) as PassRow[]).map(rowToPass)
}
