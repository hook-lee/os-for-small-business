import { describe, it, expect } from 'vitest'
import {
  passNameToPayrollCategory,
  sessionCategoryToPayrollCategory,
  bucketLessonCounts,
  resolvePayrollWindow,
  payrollCountedStatuses,
  PAYROLL_COUNTED_STATUSES,
} from '@/lib/analytics/payroll-auto'

describe('payrollCountedStatuses (센터 설정 기반)', () => {
  it('둘 다 반영 → 당일취소·노쇼 포함 (기존 동작과 동일)', () => {
    const s = payrollCountedStatuses({ sameDayCancel: true, noshow: true })
    expect(s).toEqual(['scheduled', 'completed', 'cancelled_same_day', 'noshow'])
  })
  it('당일취소 미반영 → 제외', () => {
    const s = payrollCountedStatuses({ sameDayCancel: false, noshow: true })
    expect(s).not.toContain('cancelled_same_day')
    expect(s).toContain('noshow')
  })
  it('노쇼 미반영 → 제외', () => {
    const s = payrollCountedStatuses({ sameDayCancel: true, noshow: false })
    expect(s).toContain('cancelled_same_day')
    expect(s).not.toContain('noshow')
  })
  it('예약·완료는 항상 포함', () => {
    const s = payrollCountedStatuses({ sameDayCancel: false, noshow: false })
    expect(s).toEqual(['scheduled', 'completed'])
  })
})

describe('passNameToPayrollCategory', () => {
  it('재활 → rehab', () => {
    expect(passNameToPayrollCategory('재활')).toBe('rehab')
  })
  it('듀엣 / 듀엣 체험 → duet', () => {
    expect(passNameToPayrollCategory('듀엣')).toBe('duet')
    expect(passNameToPayrollCategory('듀엣 체험')).toBe('duet')
  })
  it('그룹·소그룹 → group', () => {
    expect(passNameToPayrollCategory('3:1소그룹')).toBe('group')
    expect(passNameToPayrollCategory('2:1 소그룹')).toBe('group')
  })
  it('개인·체험·기타 → private', () => {
    expect(passNameToPayrollCategory('개인')).toBe('private')
    expect(passNameToPayrollCategory('체험')).toBe('private')
    expect(passNameToPayrollCategory(null)).toBe('private')
    expect(passNameToPayrollCategory('')).toBe('private')
  })
})

describe('sessionCategoryToPayrollCategory', () => {
  it('개인/1:1 → private', () => {
    expect(sessionCategoryToPayrollCategory('개인')).toBe('private')
    expect(sessionCategoryToPayrollCategory('1:1')).toBe('private')
  })
  it('재활→rehab, 듀엣→duet', () => {
    expect(sessionCategoryToPayrollCategory('재활')).toBe('rehab')
    expect(sessionCategoryToPayrollCategory('듀엣')).toBe('duet')
  })
  it('그룹·소그룹·null·빈값 → group (기본)', () => {
    expect(sessionCategoryToPayrollCategory('그룹')).toBe('group')
    expect(sessionCategoryToPayrollCategory('소그룹')).toBe('group')
    expect(sessionCategoryToPayrollCategory(null)).toBe('group')
    expect(sessionCategoryToPayrollCategory(undefined)).toBe('group')
  })
})

describe('bucketLessonCounts', () => {
  it('개별 passName + 예약형 수업 종류별 버킷', () => {
    const r = bucketLessonCounts(
      ['개인', '개인', '재활', '듀엣', '체험'],  // private 3(개인·개인·체험), rehab 1, duet 1
      ['그룹', '그룹', '그룹', '그룹'],          // group 4
    )
    expect(r.privateCount).toBe(3)
    expect(r.rehabCount).toBe(1)
    expect(r.duetCount).toBe(1)
    expect(r.groupCount).toBe(4)
  })
  it('예약형 수업 정원1=개인은 개인 버킷으로 (그룹 시급 오집계 방지)', () => {
    const r = bucketLessonCounts([], ['개인', '개인', '듀엣', '재활', '그룹'])
    expect(r.privateCount).toBe(2)
    expect(r.duetCount).toBe(1)
    expect(r.rehabCount).toBe(1)
    expect(r.groupCount).toBe(1)
  })
  it('빈 입력', () => {
    expect(bucketLessonCounts([], [])).toEqual({ privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0 })
  })
})

describe('PAYROLL_COUNTED_STATUSES', () => {
  it("'scheduled' 포함 (예약만 해도 급여 집계 — 기존 버그 수정)", () => {
    expect(PAYROLL_COUNTED_STATUSES).toContain('scheduled')
    expect(PAYROLL_COUNTED_STATUSES).toContain('completed')
    expect(PAYROLL_COUNTED_STATUSES).toContain('cancelled_same_day')
    expect(PAYROLL_COUNTED_STATUSES).toContain('noshow')
  })
  it("사전 취소(cancelled_advance)는 제외", () => {
    expect(PAYROLL_COUNTED_STATUSES).not.toContain('cancelled_advance')
  })
})

describe('resolvePayrollWindow', () => {
  it("full: 그 달 1일 ~ 말일", () => {
    expect(resolvePayrollWindow('2026-06', 'full', '2026-06-10')).toEqual({ start: '2026-06-01', end: '2026-06-30' })
    // today 무관
    expect(resolvePayrollWindow('2026-02', 'full', '2030-01-01')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
  it("todate: 그 달 1일 ~ min(today, 말일)", () => {
    expect(resolvePayrollWindow('2026-06', 'todate', '2026-06-10')).toEqual({ start: '2026-06-01', end: '2026-06-10' })
  })
  it("todate: today가 그 달 말일 이후면 말일로 클램프 (지난 달 = 전체)", () => {
    expect(resolvePayrollWindow('2026-06', 'todate', '2026-09-01')).toEqual({ start: '2026-06-01', end: '2026-06-30' })
  })
  it("todate: today가 그 달 이전이면 빈 창(end<start) → 0건", () => {
    const w = resolvePayrollWindow('2026-06', 'todate', '2026-05-20')
    expect(w.end < w.start).toBe(true)
  })
})
