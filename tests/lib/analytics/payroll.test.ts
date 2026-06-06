import { describe, it, expect } from 'vitest'
import {
  computePayrollTotal,
  computeTaxWithholding,
  computeMemberRateAdjustment,
  type MemberLessonBucket,
  type MemberRateOverride,
} from '@/lib/analytics/payroll'
import type { Instructor } from '@/lib/supabase/instructors'

const instructor: Instructor = {
  id: 1, name: '김유진', phone: null, email: null, role: 'owner',
  employmentType: null, defaultHourlyRate: 30000,
  ratePrivate: 30000, rateRehab: 35000, rateDuet: 40000, rateGroup: 20000,
  color: null, active: true, authUserId: null,
}

describe('computePayrollTotal', () => {
  it('각 종류별 횟수 × 시급 합산', () => {
    const r = computePayrollTotal(instructor, {
      privateCount: 10, rehabCount: 5, duetCount: 3, groupCount: 8,
    })
    expect(r.privateTotal).toBe(300_000)
    expect(r.rehabTotal).toBe(175_000)
    expect(r.duetTotal).toBe(120_000)
    expect(r.groupTotal).toBe(160_000)
    expect(r.grossTotal).toBe(755_000)
  })

  it('0 횟수면 0', () => {
    const r = computePayrollTotal(instructor, { privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0 })
    expect(r.grossTotal).toBe(0)
  })

  it('시급 균등(30k)이면 총 = (총횟수) × 30k', () => {
    const equalInst = { ...instructor, rateRehab: 30000, rateDuet: 30000, rateGroup: 30000 }
    const r = computePayrollTotal(equalInst, { privateCount: 2, rehabCount: 3, duetCount: 1, groupCount: 4 })
    expect(r.grossTotal).toBe(10 * 30000)
  })
})

describe('computeMemberRateAdjustment (회원별 시급/인센티브)', () => {
  // 회원 A: 개인 5회, 회원 B: 재활 4회
  const byMember: MemberLessonBucket[] = [
    { memberId: 101, memberName: '회원A', counts: { privateCount: 5, rehabCount: 0, duetCount: 0, groupCount: 0 } },
    { memberId: 102, memberName: '회원B', counts: { privateCount: 0, rehabCount: 4, duetCount: 0, groupCount: 0 } },
  ]

  it('override 없으면 adjustment 0 (기존 동작 유지)', () => {
    const r = computeMemberRateAdjustment(instructor, byMember, new Map())
    expect(r.adjustment).toBe(0)
    expect(r.lines).toHaveLength(0)
  })

  it('단일 시급이 강사 기본보다 높으면 차액만큼 +조정', () => {
    // 회원A 개인 기본 30,000 → 단일 50,000. 5회 × (50,000-30,000) = +100,000
    const map = new Map<number, MemberRateOverride>([
      [101, { customRate: 50_000, incentivePerSession: 0 }],
    ])
    const r = computeMemberRateAdjustment(instructor, byMember, map)
    expect(r.adjustment).toBe(100_000)
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].memberId).toBe(101)
    expect(r.lines[0].effectiveSubtotal).toBe(250_000)
    expect(r.lines[0].naiveSubtotal).toBe(150_000)
    expect(r.lines[0].delta).toBe(100_000)
  })

  it('단일 시급은 카테고리 무시하고 모든 수업에 적용', () => {
    // 회원B 재활 기본 35,000 → 단일 30,000. 4회 × (30,000-35,000) = -20,000
    const map = new Map<number, MemberRateOverride>([
      [102, { customRate: 30_000, incentivePerSession: 0 }],
    ])
    const r = computeMemberRateAdjustment(instructor, byMember, map)
    expect(r.adjustment).toBe(-20_000)
  })

  it('인센티브는 회당 추가로 더해짐 (시급 override 없어도)', () => {
    // 회원A 5회 × 1,000 인센티브 = +5,000
    const map = new Map<number, MemberRateOverride>([
      [101, { customRate: null, incentivePerSession: 1_000 }],
    ])
    const r = computeMemberRateAdjustment(instructor, byMember, map)
    expect(r.adjustment).toBe(5_000)
    expect(r.lines[0].baseRate).toBeNull()
    expect(r.lines[0].incentiveTotal).toBe(5_000)
  })

  it('시급 + 인센티브 동시 적용', () => {
    // 회원A: (50,000-30,000)×5 + 1,000×5 = 100,000 + 5,000 = 105,000
    const map = new Map<number, MemberRateOverride>([
      [101, { customRate: 50_000, incentivePerSession: 1_000 }],
    ])
    const r = computeMemberRateAdjustment(instructor, byMember, map)
    expect(r.adjustment).toBe(105_000)
  })

  it('수업 0회인 회원은 무시', () => {
    const empty: MemberLessonBucket[] = [
      { memberId: 999, memberName: '무수강', counts: { privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0 } },
    ]
    const map = new Map<number, MemberRateOverride>([[999, { customRate: 99_999, incentivePerSession: 9999 }]])
    const r = computeMemberRateAdjustment(instructor, empty, map)
    expect(r.adjustment).toBe(0)
    expect(r.lines).toHaveLength(0)
  })

  it('전체 gross = 카테고리 gross + adjustment 로 합쳐짐 (통합 검증)', () => {
    // counts 집계: 개인5 + 재활4 = naive gross
    const naive = computePayrollTotal(instructor, { privateCount: 5, rehabCount: 4, duetCount: 0, groupCount: 0 })
    expect(naive.grossTotal).toBe(5 * 30_000 + 4 * 35_000) // 290,000
    const map = new Map<number, MemberRateOverride>([
      [101, { customRate: 50_000, incentivePerSession: 0 }], // +100,000
    ])
    const { adjustment } = computeMemberRateAdjustment(instructor, byMember, map)
    expect(naive.grossTotal + adjustment).toBe(390_000)
  })
})

describe('computeTaxWithholding (3.3%)', () => {
  it('100만원 → 33,000원', () => {
    expect(computeTaxWithholding(1_000_000)).toBe(33000)
  })
  it('755,000원 → 24,915원 (반올림)', () => {
    expect(computeTaxWithholding(755_000)).toBe(24915)
  })
  it('0원 → 0', () => {
    expect(computeTaxWithholding(0)).toBe(0)
  })
})
