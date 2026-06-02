import type { Instructor } from '@/lib/supabase/instructors'

export interface PayrollCounts {
  privateCount: number
  rehabCount: number
  duetCount: number
  groupCount: number
}

export interface PayrollBreakdown {
  privateTotal: number
  rehabTotal: number
  duetTotal: number
  groupTotal: number
  grossTotal: number  // 4종 합
}

export const TAX_WITHHOLDING_RATE = 0.033

export function computeTaxWithholding(gross: number): number {
  return Math.round(gross * TAX_WITHHOLDING_RATE)
}

export function computePayrollTotal(instructor: Instructor, counts: PayrollCounts): PayrollBreakdown {
  const privateTotal = counts.privateCount * instructor.ratePrivate
  const rehabTotal = counts.rehabCount * instructor.rateRehab
  const duetTotal = counts.duetCount * instructor.rateDuet
  const groupTotal = counts.groupCount * instructor.rateGroup
  return {
    privateTotal,
    rehabTotal,
    duetTotal,
    groupTotal,
    grossTotal: privateTotal + rehabTotal + duetTotal + groupTotal,
  }
}

// ── 회원별 시급/인센티브 (v3.9) ──

export interface MemberRateOverride {
  customRate: number | null        // null = 강사 기본 시급 사용
  incentivePerSession: number      // 회당 추가 인센티브
}

export interface MemberLessonBucket {
  memberId: number
  memberName: string | null
  counts: PayrollCounts            // 이 회원이 이 강사한테 받은 수업 카테고리별 횟수
}

export interface MemberPayrollLine {
  memberId: number
  memberName: string | null
  lessonCount: number              // 4종 합
  baseRate: number | null          // 적용된 단일 시급 (override 있을 때만)
  incentivePerSession: number
  naiveSubtotal: number            // 강사 기본 시급 기준 소계
  effectiveSubtotal: number        // 단일 시급 적용 후 소계 (override 없으면 naive와 동일)
  incentiveTotal: number
  delta: number                    // (effectiveSubtotal - naiveSubtotal) + incentiveTotal
}

/**
 * 회원별 시급/인센티브가 강사 기본 시급 대비 만들어내는 "조정액"을 계산.
 *
 * - customRate가 있으면: 그 회원의 모든 수업은 카테고리 무시하고 customRate(단일 시급)로 계산 ("단일 시급 1개" 모델).
 * - incentivePerSession은 회당 추가로 더해짐.
 * - group_sessions(회원 비귀속)는 byMember에 포함되지 않으므로 조정 대상 아님 → adjustment 0 기여.
 *
 * 반환 adjustment를 기존 카테고리 기준 gross에 더하면 최종 급여.
 * override가 없으면 adjustment = 0 → 기존 동작과 완전 동일 (하위호환).
 */
export function computeMemberRateAdjustment(
  instructor: Instructor,
  byMember: MemberLessonBucket[],
  rateMap: Map<number, MemberRateOverride>,
): { adjustment: number; lines: MemberPayrollLine[] } {
  let adjustment = 0
  const lines: MemberPayrollLine[] = []

  for (const bucket of byMember) {
    const c = bucket.counts
    const lessonCount = c.privateCount + c.rehabCount + c.duetCount + c.groupCount
    if (lessonCount === 0) continue

    const naiveSubtotal =
      c.privateCount * instructor.ratePrivate +
      c.rehabCount * instructor.rateRehab +
      c.duetCount * instructor.rateDuet +
      c.groupCount * instructor.rateGroup

    const override = rateMap.get(bucket.memberId)
    const customRate = override?.customRate ?? null
    const incentivePerSession = override?.incentivePerSession ?? 0

    const effectiveSubtotal = customRate != null ? lessonCount * customRate : naiveSubtotal
    const incentiveTotal = lessonCount * incentivePerSession
    const delta = (effectiveSubtotal - naiveSubtotal) + incentiveTotal

    if (delta !== 0) {
      adjustment += delta
      lines.push({
        memberId: bucket.memberId,
        memberName: bucket.memberName,
        lessonCount,
        baseRate: customRate,
        incentivePerSession,
        naiveSubtotal,
        effectiveSubtotal,
        incentiveTotal,
        delta,
      })
    }
  }

  // 큰 조정(절댓값) 먼저
  lines.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return { adjustment, lines }
}
