import { getSupabaseClient } from './client'
import { insertTransaction, deleteTransactionsByPass } from './transactions'
import { fetchMemberById } from './members'
import { classify } from '@/lib/categories/normalize'

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

export async function fetchPassesByMember(memberId: number, ownerId: string): Promise<Pass[]> {
  const supabase = getSupabaseClient()
  let q = supabase
    .from('passes')
    .select('*')
    .eq('member_id', memberId)
    .order('paid_at', { ascending: false, nullsFirst: false })
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q
  if (error) throw new Error(`Supabase passes fetch failed: ${error.message}`)
  return ((data ?? []) as PassRow[]).map(rowToPass)
}

export async function fetchActivePassesByMember(memberId: number, ownerId: string): Promise<Pass[]> {
  const all = await fetchPassesByMember(memberId, ownerId)
  return all.filter(p => p.status === '이용중' && (p.remainingCount ?? 0) > 0)
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
  paidAt?: string            // 결제일(yyyy-mm-dd). 미입력 시 오늘. 매출 인식일·발급일로 사용 (소급 등록 지원)
  bonusCount?: number        // 회차 추가(+)/감소(-) — 서비스 1회 등. 기본 회차에 가감. 결제금액/매출엔 영향 X
}

export async function issuePass(
  input: IssuePassInput,
  product: { name: string; passType: '프라이빗' | '그룹'; durationDays: number; totalCount: number; price: number },
  ownerId: string,
): Promise<number> {
  const supabase = getSupabaseClient()
  // end_date 계산: start_date + duration_days
  const start = new Date(input.startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + product.durationDays)
  const endDate = end.toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const paidAt = input.paidAt ?? today   // 결제일(소급 가능). 매출 인식일·발급일 기준

  // 회차 추가/감소(서비스 등): 기본 회차에 가감, 0 미만은 0으로 클램프. 결제금액·매출엔 영향 없음.
  const bonus = Math.floor(input.bonusCount ?? 0)
  const effectiveCount = Math.max(0, product.totalCount + bonus)

  const row: Record<string, unknown> = {
    member_id: input.memberId,
    instructor_id: input.instructorId,
    pass_name: product.name,
    pass_type: product.passType,
    start_date: input.startDate,
    end_date: endDate,
    total_count: effectiveCount,
    remaining_count: effectiveCount,
    available_count: effectiveCount,
    cancellable_count: effectiveCount,
    status: '이용중',
    payment_type: input.paymentType ?? '신규결제',
    payment_amount: input.paymentAmount ?? product.price,
    paid_at: paidAt,
    payment_method: input.paymentMethod ?? '카드',
    installment: input.installment ?? '일시불',
    is_family: false,
    issued_at: paidAt,
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase
    .from('passes')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`Issue pass failed: ${error.message}`)
  const newPassId = (data as { id: number }).id

  // v3.7: 가계부 매출 자동 생성.
  // 수강권 발급 = 결제 = 매출. transactions에 동일 결제를 '매출'(+)로 기록해
  // 가계부 매출과 수강권 결제가 항상 일치하도록 한다. (매출 통계는 transactions만 합산)
  // Supabase JS는 멀티테이블 트랜잭션이 없으므로, 매출 생성 실패 시 방금 만든 pass를 롤백.
  const paymentAmount = input.paymentAmount ?? product.price
  const paymentMethod = input.paymentMethod ?? '카드'
  const paymentType = input.paymentType ?? '신규결제'
  try {
    let memberName: string | undefined
    try {
      const member = await fetchMemberById(input.memberId, ownerId)
      memberName = member?.name ?? undefined
    } catch {
      // 회원 조회 실패해도 매출 기록은 진행 (counterparty만 비움)
    }

    await insertTransaction(
      {
        date: today, // paid_at과 동일 — 결제일 기준 매출 인식
        rawCategory: '매출',
        category: '매출',
        amount: Math.abs(paymentAmount), // 매출은 +
        method: paymentMethod,
        counterparty: memberName, // 거래처 = 회원 이름
        classification: classify('매출'), // 'business'
        memo: `${product.name} ${paymentType}`,
        memberId: input.memberId,
        instructorId: input.instructorId,
        passProductId: input.productId,
        passId: newPassId,
      },
      ownerId,
    )
  } catch (txErr) {
    // 롤백: 매출 생성 실패 → 방금 만든 수강권 삭제 (둘은 항상 함께 존재해야 정합 유지)
    try {
      await deletePass(newPassId, ownerId)
    } catch {
      // best-effort 롤백 — 실패해도 아래 에러로 사용자에게 알림
    }
    throw new Error(`수강권 매출 연동 실패 (수강권 롤백됨): ${(txErr as Error).message}`)
  }

  return newPassId
}

export async function fetchAllPasses(ownerId: string): Promise<Pass[]> {
  const supabase = getSupabaseClient()
  const PAGE = 1000
  const all: Pass[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('passes')
      .select('*')
      .order('paid_at', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE - 1)
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error) throw new Error(`Supabase passes fetch failed: ${error.message}`)
    const rows = (data ?? []) as PassRow[]
    if (rows.length === 0) break
    all.push(...rows.map(rowToPass))
    if (rows.length < PAGE) break
  }
  return all
}

export async function deletePass(id: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  // v3.7: 발급 시 자동 생성된 연결 매출(transactions.pass_id=id)을 먼저 정리.
  // 결제(pass)를 지우면 그 매출도 함께 사라져야 가계부 정합이 유지된다.
  // 과거 import분은 연결 매출이 없으므로 0건 삭제 — 에러 아님.
  await deleteTransactionsByPass(id, ownerId)

  let q = supabase.from('passes').delete().eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Delete pass failed: ${error.message}`)
}

export interface UpdatePassInput {
  instructorId?: number | null
  status?: string
  remainingCount?: number
  availableCount?: number
  cancellableCount?: number
  endDate?: string
  paymentAmount?: number
}

export async function updatePass(id: number, patch: UpdatePassInput, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const dbPatch: Record<string, unknown> = { last_modified_at: new Date().toISOString().slice(0, 10) }
  if (patch.instructorId !== undefined) dbPatch.instructor_id = patch.instructorId
  if (patch.status !== undefined) dbPatch.status = patch.status
  if (patch.remainingCount !== undefined) dbPatch.remaining_count = patch.remainingCount
  if (patch.availableCount !== undefined) dbPatch.available_count = patch.availableCount
  if (patch.cancellableCount !== undefined) dbPatch.cancellable_count = patch.cancellableCount
  if (patch.endDate !== undefined) dbPatch.end_date = patch.endDate
  if (patch.paymentAmount !== undefined) dbPatch.payment_amount = patch.paymentAmount

  let q = supabase.from('passes').update(dbPatch).eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Update pass failed: ${error.message}`)
}

/**
 * 수강권 회차 보너스/차감.
 * delta > 0: 보너스 (예: 신규 10회 결제 시 +1)
 * delta < 0: 차감
 * total_count, remaining_count, available_count 모두 delta만큼 조정.
 * pass_adjustments에 로그 기록.
 */
export async function adjustPassCount(passId: number, delta: number, reason: string, ownerId: string): Promise<void> {
  if (!Number.isFinite(delta) || delta === 0) throw new Error('delta must be a non-zero integer')
  if (!reason || !reason.trim()) throw new Error('reason 필수')

  const supabase = getSupabaseClient()
  // 현재 값 조회 (owner_id 격리)
  let readQ = supabase
    .from('passes')
    .select('total_count, remaining_count, available_count')
    .eq('id', passId)
  if (ownerId !== 'no-auth') readQ = readQ.eq('owner_id', ownerId)
  const { data: row, error: readErr } = await readQ.single()
  if (readErr || !row) throw new Error(`Pass not found: ${readErr?.message ?? passId}`)

  const r = row as { total_count: number | null; remaining_count: number | null; available_count: number | null }
  const newTotal = (r.total_count ?? 0) + delta
  const newRemaining = (r.remaining_count ?? 0) + delta
  const newAvailable = (r.available_count ?? 0) + delta

  if (newRemaining < 0 || newAvailable < 0) throw new Error('잔여/사용가능 회차가 0 미만이 됩니다')

  let updQ = supabase
    .from('passes')
    .update({
      total_count: newTotal,
      remaining_count: newRemaining,
      available_count: newAvailable,
      last_modified_at: new Date().toISOString().slice(0, 10),
    })
    .eq('id', passId)
  if (ownerId !== 'no-auth') updQ = updQ.eq('owner_id', ownerId)
  const { error: updErr } = await updQ
  if (updErr) throw new Error(`Adjust pass failed: ${updErr.message}`)

  // 로그 기록 (실패해도 메인 작업은 성공으로 처리 — 로그 부재가 비즈니스 차단점은 아님)
  // pass_adjustments는 owner_id 컬럼 없음 (마이그레이션 SQL 12개 테이블에 포함 안 됨) → 기존 그대로
  const { error: logErr } = await supabase
    .from('pass_adjustments')
    .insert({ pass_id: passId, delta, reason: reason.trim() })
  if (logErr) console.warn(`pass_adjustments log failed: ${logErr.message}`)
}

export interface PassAdjustment {
  id: number
  passId: number
  delta: number
  reason: string
  createdAt: string
}

export async function fetchAdjustmentsByPass(passId: number): Promise<PassAdjustment[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('pass_adjustments')
    .select('*')
    .eq('pass_id', passId)
    .order('created_at', { ascending: false })
  if (error) return []
  return ((data ?? []) as Array<{ id: number; pass_id: number; delta: number; reason: string; created_at: string }>).map(r => ({
    id: r.id,
    passId: r.pass_id,
    delta: r.delta,
    reason: r.reason,
    createdAt: r.created_at,
  }))
}
