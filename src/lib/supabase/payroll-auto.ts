import { getSupabaseClient } from './client'
import {
  bucketLessonCounts,
  passNameToPayrollCategory,
  resolvePayrollWindow,
  PAYROLL_COUNTED_STATUSES,
  type PayrollAggregateMode,
} from '@/lib/analytics/payroll-auto'
import type { MemberLessonBucket, PayrollCounts } from '@/lib/analytics/payroll'

export interface AutoPayrollCounts {
  privateCount: number; rehabCount: number; duetCount: number; groupCount: number
  individualLessonsCount: number
  groupSessionsCount: number
}

export async function fetchAutoPayrollCounts(instructorId: number, yearMonth: string, ownerId: string): Promise<AutoPayrollCounts> {
  const { counts } = await fetchAutoPayrollBreakdown(instructorId, yearMonth, ownerId)
  return counts
}

/**
 * 자동 집계 + 회원별 분해.
 * - counts: 카테고리별 합계 (group_sessions 포함, 기존과 동일) — 강사 기본 시급 계산용.
 * - byMember: 회원별 개별 수업 카테고리 카운트 — 회원별 시급/인센티브 조정 계산용.
 *   (group_sessions는 회원 비귀속이라 byMember에 미포함, counts.groupCount엔 포함됨)
 */
export async function fetchAutoPayrollBreakdown(
  instructorId: number,
  yearMonth: string,
  ownerId: string,
  mode: PayrollAggregateMode = 'full',
  today: string = new Date().toISOString().slice(0, 10),
): Promise<{
  counts: AutoPayrollCounts
  byMember: MemberLessonBucket[]
}> {
  try {
    const supabase = getSupabaseClient()
    const { start, end } = resolvePayrollWindow(yearMonth, mode, today)

    let lessonsQ = supabase
      .from('lessons')
      .select('pass_id, member_id, passes(pass_name), members(id, name)')
      .eq('instructor_id', instructorId)
      .gte('lesson_date', start)
      .lte('lesson_date', end)
      .in('status', [...PAYROLL_COUNTED_STATUSES])
    if (ownerId !== 'no-auth') lessonsQ = lessonsQ.eq('owner_id', ownerId)
    const { data: lessons } = await lessonsQ

    // select('*')로 받아 category 컬럼이 아직 없는 배포 DB(마이그레이션 전)에서도 에러 없이
    // category=undefined → '그룹'으로 폴백 (기존 동작 유지).
    let groupQ = supabase
      .from('group_sessions')
      .select('*')
      .eq('instructor_id', instructorId)
      .eq('active', true)
      .gte('lesson_date', start)
      .lte('lesson_date', end)
    if (ownerId !== 'no-auth') groupQ = groupQ.eq('owner_id', ownerId)
    const { data: groupSessions } = await groupQ

    type LessonRow = {
      pass_id: number | null
      member_id: number | null
      passes: { pass_name: string } | { pass_name: string }[] | null
      members: { id: number; name: string } | { id: number; name: string }[] | null
    }
    const rows = (lessons ?? []) as LessonRow[]
    const passNames = rows.map(l => {
      const p = Array.isArray(l.passes) ? l.passes[0] : l.passes
      return p?.pass_name ?? null
    })

    const groupRows = (groupSessions ?? []) as Array<{ id: number; category?: string | null }>
    const groupSessionsCount = groupRows.length
    // 예약형 수업을 종류별로 버킷팅 (개인 정원1 = 개인 시급, 그룹 = 그룹 시급 등)
    const counts = bucketLessonCounts(passNames, groupRows.map(g => g.category ?? null))

    // 회원별 분해
    const memberMap = new Map<number, MemberLessonBucket>()
    for (const l of rows) {
      const memberId = l.member_id
      if (memberId == null) continue
      const member = Array.isArray(l.members) ? l.members[0] : l.members
      const pass = Array.isArray(l.passes) ? l.passes[0] : l.passes
      const cat = passNameToPayrollCategory(pass?.pass_name ?? null)
      let bucket = memberMap.get(memberId)
      if (!bucket) {
        bucket = {
          memberId,
          memberName: member?.name ?? null,
          counts: { privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0 } as PayrollCounts,
        }
        memberMap.set(memberId, bucket)
      }
      if (cat === 'private') bucket.counts.privateCount++
      else if (cat === 'rehab') bucket.counts.rehabCount++
      else if (cat === 'duet') bucket.counts.duetCount++
      else if (cat === 'group') bucket.counts.groupCount++
    }

    return {
      counts: {
        ...counts,
        individualLessonsCount: passNames.length,
        groupSessionsCount,
      },
      byMember: Array.from(memberMap.values()),
    }
  } catch {
    return {
      counts: { privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0, individualLessonsCount: 0, groupSessionsCount: 0 },
      byMember: [],
    }
  }
}
