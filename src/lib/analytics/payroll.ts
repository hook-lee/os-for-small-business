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

// ── 카테고리 기반 급여 (§0 — 센터마다 수업 종류가 달라 4종 고정 대신 카테고리 맵) ──

/** 카테고리 → 횟수. 예: { '필라테스': 10, '요가': 4 } */
export type CategoryCounts = Record<string, number>

/**
 * 강사의 '실효 시급 맵' (카테고리 → 시급).
 * categoryRates(원장 설정)가 우선. 비어있으면 레거시 4종(개인/재활/듀엣/그룹, 0원 제외)을 폴백.
 * → 마이그레이션 전(categoryRates 미설정)에도 기존 시급이 그대로 적용돼 급여가 안 깨진다.
 */
export function effectiveRateMap(
  instructor: Pick<Instructor, 'ratePrivate' | 'rateRehab' | 'rateDuet' | 'rateGroup' | 'categoryRates'>,
): Record<string, number> {
  const legacy: Record<string, number> = {}
  if (instructor.ratePrivate > 0) legacy['개인'] = instructor.ratePrivate
  if (instructor.rateRehab > 0) legacy['재활'] = instructor.rateRehab
  if (instructor.rateDuet > 0) legacy['듀엣'] = instructor.rateDuet
  if (instructor.rateGroup > 0) legacy['그룹'] = instructor.rateGroup
  return { ...legacy, ...(instructor.categoryRates ?? {}) }
}

/** 특정 카테고리의 강사 시급. 설정 없으면 기본 시급(defaultHourlyRate) 폴백. */
export function instructorRateForCategory(instructor: Instructor, category: string | null | undefined): number {
  const map = effectiveRateMap(instructor)
  if (category && map[category] != null) return map[category]
  return instructor.defaultHourlyRate
}

/** 카테고리별 횟수 × 시급 합산. */
export function computeCategoryPayroll(
  instructor: Instructor,
  counts: CategoryCounts,
): { byCategory: Record<string, number>; grossTotal: number } {
  const byCategory: Record<string, number> = {}
  let grossTotal = 0
  for (const [cat, count] of Object.entries(counts)) {
    const subtotal = count * instructorRateForCategory(instructor, cat)
    byCategory[cat] = subtotal
    grossTotal += subtotal
  }
  return { byCategory, grossTotal }
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

/** 회원별 카테고리 횟수 버킷 (MemberLessonBucket의 카테고리 버전). */
export interface CategoryMemberBucket {
  memberId: number
  memberName: string | null
  counts: CategoryCounts
}

/**
 * 카테고리 기반 회원별 시급/인센티브 조정. computeMemberRateAdjustment의 카테고리 버전.
 * - naiveSubtotal = Σ(카테고리 횟수 × 강사 카테고리 시급)
 * - customRate 있으면: 그 회원 전 수업을 단일 시급으로 재계산
 * - incentivePerSession: 회당 추가
 */
export function computeCategoryMemberAdjustment(
  instructor: Instructor,
  byMember: CategoryMemberBucket[],
  rateMap: Map<number, MemberRateOverride>,
): { adjustment: number; lines: MemberPayrollLine[] } {
  let adjustment = 0
  const lines: MemberPayrollLine[] = []

  for (const bucket of byMember) {
    const entries = Object.entries(bucket.counts)
    const lessonCount = entries.reduce((s, [, n]) => s + n, 0)
    if (lessonCount === 0) continue

    const naiveSubtotal = entries.reduce(
      (s, [cat, n]) => s + n * instructorRateForCategory(instructor, cat),
      0,
    )

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

  lines.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return { adjustment, lines }
}
