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

export function rowToPass(row: PassRow): Pass {
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

export interface IssuePassInput {
  memberId: number
  instructorId: number | null
  productId: number          // pass_product id (lookup for snapshot fields)
  startDate: string          // yyyy-mm-dd
  paymentAmount?: number     // 사용자가 할인했을 수도 — 미입력 시 product.price
  paymentMethod?: '카드' | '계좌이체' | '현금'
  installment?: string
  paymentType?: '신규결제' | '재결제'  // default '신규결제'
}

export async function issuePass(
  input: IssuePassInput,
  product: { name: string; passType: '프라이빗' | '그룹'; durationDays: number; totalCount: number; price: number }
): Promise<number> {
  const supabase = getSupabaseClient()
  // end_date 계산: start_date + duration_days
  const start = new Date(input.startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + product.durationDays)
  const endDate = end.toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('passes')
    .insert({
      member_id: input.memberId,
      instructor_id: input.instructorId,
      pass_name: product.name,
      pass_type: product.passType,
      start_date: input.startDate,
      end_date: endDate,
      total_count: product.totalCount,
      remaining_count: product.totalCount,
      available_count: product.totalCount,
      cancellable_count: product.totalCount,
      status: '이용중',
      payment_type: input.paymentType ?? '신규결제',
      payment_amount: input.paymentAmount ?? product.price,
      paid_at: today,
      payment_method: input.paymentMethod ?? '카드',
      installment: input.installment ?? '일시불',
      is_family: false,
      issued_at: today,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Issue pass failed: ${error.message}`)
  return (data as { id: number }).id
}

export async function fetchAllPasses(): Promise<Pass[]> {
  const supabase = getSupabaseClient()
  const PAGE = 1000
  const all: Pass[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('passes')
      .select('*')
      .order('paid_at', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Supabase passes fetch failed: ${error.message}`)
    const rows = (data ?? []) as PassRow[]
    if (rows.length === 0) break
    all.push(...rows.map(rowToPass))
    if (rows.length < PAGE) break
  }
  return all
}

export async function deletePass(id: number): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('passes').delete().eq('id', id)
  if (error) throw new Error(`Delete pass failed: ${error.message}`)
}
