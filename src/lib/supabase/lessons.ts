import { getSupabaseClient } from './client'

export type LessonStatus = 'scheduled' | 'completed' | 'cancelled_same_day' | 'cancelled_advance' | 'noshow'

const DEDUCTED_STATUSES: LessonStatus[] = ['completed', 'cancelled_same_day', 'noshow']
export function statusDeducts(s: LessonStatus): boolean {
  return DEDUCTED_STATUSES.includes(s)
}

export const STATUS_LABEL: Record<LessonStatus, string> = {
  scheduled: '예약',
  completed: '완료',
  cancelled_same_day: '당일 취소',
  cancelled_advance: '사전 취소',
  noshow: '노쇼',
}

export interface Lesson {
  id: number
  passId: number | null
  memberId: number
  instructorId: number | null
  lessonDate: string
  lessonTime: string | null
  durationMinutes: number
  status: LessonStatus
  deducted: boolean
  memo: string | null
}

interface LessonRow {
  id: number
  pass_id: number | null
  member_id: number
  instructor_id: number | null
  lesson_date: string
  lesson_time: string | null
  duration_minutes: number
  status: string
  deducted: boolean
  memo: string | null
}

export function rowToLesson(row: LessonRow): Lesson {
  return {
    id: row.id,
    passId: row.pass_id,
    memberId: row.member_id,
    instructorId: row.instructor_id,
    lessonDate: row.lesson_date,
    lessonTime: row.lesson_time,
    durationMinutes: row.duration_minutes,
    status: row.status as LessonStatus,
    deducted: row.deducted,
    memo: row.memo,
  }
}

export interface LessonWithNames extends Lesson {
  memberName: string
  memberPhone: string | null
  instructorName: string | null
  passName: string | null
  passRemaining: number | null
}

export async function fetchLessonsByDate(date: string): Promise<LessonWithNames[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('lessons')
      .select('*, members(id, name, phone), instructors(id, name), passes(id, pass_name, remaining_count)')
      .eq('lesson_date', date)
      .order('lesson_time', { ascending: true, nullsFirst: false })
    if (error) return []
    type Joined = LessonRow & {
      members: { id: number; name: string; phone: string | null } | null
      instructors: { id: number; name: string } | null
      passes: { id: number; pass_name: string; remaining_count: number | null } | null
    }
    return ((data ?? []) as Joined[]).map(row => ({
      ...rowToLesson(row),
      memberName: row.members?.name ?? '?',
      memberPhone: row.members?.phone ?? null,
      instructorName: row.instructors?.name ?? null,
      passName: row.passes?.pass_name ?? null,
      passRemaining: row.passes?.remaining_count ?? null,
    }))
  } catch {
    return []
  }
}

export async function fetchLessonsByMonth(yearMonth: string): Promise<LessonWithNames[]> {
  try {
    const supabase = getSupabaseClient()
    const start = `${yearMonth}-01`
    const [y, m] = yearMonth.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
    const { data, error } = await supabase
      .from('lessons')
      .select('*, members(id, name, phone), instructors(id, name), passes(id, pass_name, remaining_count)')
      .gte('lesson_date', start)
      .lte('lesson_date', end)
      .order('lesson_date', { ascending: true })
      .order('lesson_time', { ascending: true, nullsFirst: false })
    if (error) return []
    type Joined = LessonRow & {
      members: { id: number; name: string; phone: string | null } | null
      instructors: { id: number; name: string } | null
      passes: { id: number; pass_name: string; remaining_count: number | null } | null
    }
    return ((data ?? []) as Joined[]).map(row => ({
      ...rowToLesson(row),
      memberName: row.members?.name ?? '?',
      memberPhone: row.members?.phone ?? null,
      instructorName: row.instructors?.name ?? null,
      passName: row.passes?.pass_name ?? null,
      passRemaining: row.passes?.remaining_count ?? null,
    }))
  } catch {
    return []
  }
}

export interface CreateLessonInput {
  passId?: number | null
  memberId: number
  instructorId?: number | null
  lessonDate: string
  lessonTime?: string
  durationMinutes?: number
  memo?: string
}

export async function createLesson(input: CreateLessonInput): Promise<number> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('lessons')
    .insert({
      pass_id: input.passId ?? null,
      member_id: input.memberId,
      instructor_id: input.instructorId ?? null,
      lesson_date: input.lessonDate,
      lesson_time: input.lessonTime ?? null,
      duration_minutes: input.durationMinutes ?? 50,
      status: 'scheduled',
      deducted: false,
      memo: input.memo ?? null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Create lesson failed: ${error.message}`)
  return (data as { id: number }).id
}

/**
 * 상태 변경 + 회차 자동 +/-.
 * 반환: 차감 변화량 (-1, 0, +1) — UI에서 즉시 반영용.
 */
export async function setLessonStatus(lessonId: number, newStatus: LessonStatus): Promise<{ deductionDelta: number }> {
  const supabase = getSupabaseClient()

  // 1. Fetch current
  const { data: current, error: fetchError } = await supabase
    .from('lessons')
    .select('id, pass_id, status, deducted')
    .eq('id', lessonId)
    .single()
  if (fetchError || !current) throw new Error(`Lesson fetch failed: ${fetchError?.message ?? 'not found'}`)

  const currentDeducted = (current as { deducted: boolean }).deducted
  const targetDeducts = statusDeducts(newStatus)
  // delta: pass.remaining_count에 적용할 변화.
  //   currentDeducted=false → targetDeducts=true: -1 (차감 새로 발생)
  //   currentDeducted=true → targetDeducts=false: +1 (차감 되돌림)
  //   같으면 0
  let delta = 0
  if (!currentDeducted && targetDeducts) delta = -1
  if (currentDeducted && !targetDeducts) delta = +1

  const passId = (current as { pass_id: number | null }).pass_id

  // 2. Update pass.remaining_count if linked + delta != 0
  if (passId && delta !== 0) {
    // Atomic: 단순 select + 산술 + update. Postgres RPC 없으면 단순 race condition 있지만 단일 사용자 가정.
    const { data: pass } = await supabase
      .from('passes')
      .select('remaining_count, available_count, status')
      .eq('id', passId)
      .single()
    if (pass) {
      const cur = (pass as { remaining_count: number | null }).remaining_count ?? 0
      const newRemaining = Math.max(0, cur + delta)
      const passStatus = (pass as { status: string | null }).status
      const updates: Record<string, unknown> = { remaining_count: newRemaining, last_modified_at: new Date().toISOString().slice(0, 10) }
      // 잔여 0 + 이용중 → 자동 만료
      if (newRemaining === 0 && passStatus === '이용중') {
        updates.status = '이용만료'
      }
      // 잔여 > 0 + 만료였으면 다시 이용중으로 (되돌림 케이스)
      if (newRemaining > 0 && passStatus === '이용만료' && delta > 0) {
        updates.status = '이용중'
      }
      await supabase.from('passes').update(updates).eq('id', passId)
    }
  }

  // 3. Update lesson status + deducted
  const { error: updateError } = await supabase
    .from('lessons')
    .update({
      status: newStatus,
      deducted: targetDeducts,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonId)
  if (updateError) throw new Error(`Update lesson failed: ${updateError.message}`)

  return { deductionDelta: delta }
}

export async function fetchLessonsByMember(memberId: number): Promise<Lesson[]> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('member_id', memberId)
      .order('lesson_date', { ascending: false })
    if (error) return []
    return ((data ?? []) as LessonRow[]).map(rowToLesson)
  } catch {
    return []
  }
}

export async function deleteLesson(lessonId: number): Promise<{ deductionDelta: number }> {
  // 삭제 = 차감 되돌림 (있었다면)
  const supabase = getSupabaseClient()

  const { data: current } = await supabase
    .from('lessons')
    .select('pass_id, deducted')
    .eq('id', lessonId)
    .single()

  let delta = 0
  if (current && (current as { deducted: boolean }).deducted) {
    const passId = (current as { pass_id: number | null }).pass_id
    if (passId) {
      const { data: pass } = await supabase.from('passes').select('remaining_count, status').eq('id', passId).single()
      if (pass) {
        const cur = (pass as { remaining_count: number | null }).remaining_count ?? 0
        const newRemaining = cur + 1
        const passStatus = (pass as { status: string | null }).status
        const updates: Record<string, unknown> = { remaining_count: newRemaining, last_modified_at: new Date().toISOString().slice(0, 10) }
        if (passStatus === '이용만료' && newRemaining > 0) updates.status = '이용중'
        await supabase.from('passes').update(updates).eq('id', passId)
        delta = +1
      }
    }
  }

  const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
  if (error) throw new Error(`Delete lesson failed: ${error.message}`)
  return { deductionDelta: delta }
}
