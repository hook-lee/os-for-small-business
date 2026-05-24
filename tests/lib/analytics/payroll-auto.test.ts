import { describe, it, expect } from 'vitest'
import { passNameToPayrollCategory, bucketLessonCounts } from '@/lib/analytics/payroll-auto'

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

describe('bucketLessonCounts', () => {
  it('각 카테고리 카운트 + 그룹 세션 더하기', () => {
    const r = bucketLessonCounts(
      ['개인', '개인', '재활', '듀엣', '체험'],  // private 3 (개인·개인·체험), rehab 1, duet 1, group 0
      4,  // 그룹 세션 4건
    )
    expect(r.privateCount).toBe(3)
    expect(r.rehabCount).toBe(1)
    expect(r.duetCount).toBe(1)
    expect(r.groupCount).toBe(4)  // 0 + 4
  })
  it('빈 입력', () => {
    expect(bucketLessonCounts([], 0)).toEqual({ privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0 })
  })
})
