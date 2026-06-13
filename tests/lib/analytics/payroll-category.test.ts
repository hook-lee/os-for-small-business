import { describe, it, expect } from 'vitest'
import {
  effectiveRateMap,
  instructorRateForCategory,
  computeCategoryPayroll,
  computeCategoryMemberAdjustment,
  type CategoryCounts,
  type CategoryMemberBucket,
  type MemberRateOverride,
} from '@/lib/analytics/payroll'
import type { Instructor } from '@/lib/supabase/instructors'

function makeInstructor(partial: Partial<Instructor> = {}): Instructor {
  return {
    id: 1, name: '강사', phone: null, email: null, role: 'instructor',
    employmentType: null, defaultHourlyRate: 20000,
    ratePrivate: 30000, rateRehab: 35000, rateDuet: 25000, rateGroup: 22000,
    categoryRates: {},
    color: null, active: true, authUserId: null,
    ...partial,
  }
}

describe('effectiveRateMap', () => {
  it('categoryRates 비어있으면 레거시 4종(개인/재활/듀엣/그룹)을 폴백 맵으로', () => {
    expect(effectiveRateMap(makeInstructor())).toEqual({ 개인: 30000, 재활: 35000, 듀엣: 25000, 그룹: 22000 })
  })
  it('categoryRates가 레거시를 덮어쓰고 새 카테고리를 추가', () => {
    const m = effectiveRateMap(makeInstructor({ categoryRates: { 개인: 40000, 요가: 28000 } }))
    expect(m.개인).toBe(40000) // 레거시 30000 덮어씀
    expect(m.요가).toBe(28000) // 새 카테고리
  })
  it('레거시 0원은 폴백 맵에 안 넣음', () => {
    const m = effectiveRateMap(makeInstructor({ ratePrivate: 0, rateRehab: 0, rateDuet: 0, rateGroup: 0 }))
    expect(m).toEqual({})
  })
})

describe('instructorRateForCategory', () => {
  it('설정된 카테고리는 그 시급', () => {
    expect(instructorRateForCategory(makeInstructor({ categoryRates: { 요가: 28000 } }), '요가')).toBe(28000)
  })
  it('미설정 카테고리는 기본 시급 폴백', () => {
    expect(instructorRateForCategory(makeInstructor({ categoryRates: { 요가: 28000 } }), '필라테스')).toBe(20000)
  })
  it('null 카테고리는 기본 시급', () => {
    expect(instructorRateForCategory(makeInstructor(), null)).toBe(20000)
  })
})

describe('computeCategoryPayroll', () => {
  it('카테고리별 횟수 × 시급 합산 (센터 커스텀 카테고리)', () => {
    const inst = makeInstructor({ categoryRates: { 필라테스: 30000, 요가: 25000 } })
    const counts: CategoryCounts = { 필라테스: 10, 요가: 4 }
    const r = computeCategoryPayroll(inst, counts)
    expect(r.byCategory.필라테스).toBe(300000)
    expect(r.byCategory.요가).toBe(100000)
    expect(r.grossTotal).toBe(400000)
  })
  it('시급 미설정 카테고리는 기본 시급으로', () => {
    const inst = makeInstructor({ defaultHourlyRate: 20000, categoryRates: { 필라테스: 30000 } })
    const r = computeCategoryPayroll(inst, { 필라테스: 2, 점핑: 3 })
    expect(r.byCategory.점핑).toBe(60000) // 3 × 20000(default)
    expect(r.grossTotal).toBe(120000)
  })
  it('레거시 폴백 — categoryRates 비어도 개인/그룹 시급 적용', () => {
    const r = computeCategoryPayroll(makeInstructor(), { 개인: 10, 그룹: 8 })
    expect(r.byCategory.개인).toBe(300000) // 10 × 30000
    expect(r.byCategory.그룹).toBe(176000) // 8 × 22000
    expect(r.grossTotal).toBe(476000)
  })
})

describe('computeCategoryMemberAdjustment', () => {
  const inst = makeInstructor({ categoryRates: { 개인: 30000 } })
  it('override 없으면 조정 0', () => {
    const byMember: CategoryMemberBucket[] = [{ memberId: 1, memberName: 'A', counts: { 개인: 5 } }]
    expect(computeCategoryMemberAdjustment(inst, byMember, new Map()).adjustment).toBe(0)
  })
  it('customRate면 단일 시급으로 전체 재계산', () => {
    const byMember: CategoryMemberBucket[] = [{ memberId: 1, memberName: 'A', counts: { 개인: 10 } }]
    const rateMap = new Map<number, MemberRateOverride>([[1, { customRate: 40000, incentivePerSession: 0 }]])
    // naive 10×30000=300000, effective 10×40000=400000, delta +100000
    expect(computeCategoryMemberAdjustment(inst, byMember, rateMap).adjustment).toBe(100000)
  })
  it('incentivePerSession은 회당 추가', () => {
    const byMember: CategoryMemberBucket[] = [{ memberId: 1, memberName: 'A', counts: { 개인: 4 } }]
    const rateMap = new Map<number, MemberRateOverride>([[1, { customRate: null, incentivePerSession: 5000 }]])
    expect(computeCategoryMemberAdjustment(inst, byMember, rateMap).adjustment).toBe(20000) // 4×5000
  })
})
