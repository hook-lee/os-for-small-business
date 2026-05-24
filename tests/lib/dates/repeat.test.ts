import { describe, it, expect } from 'vitest'
import { generateRepeatDates } from '@/lib/dates/repeat'

describe('generateRepeatDates', () => {
  it('월수금 1주 (2026-05-25 월 ~ 2026-05-31 일)', () => {
    // 5/25=월, 5/26=화, 5/27=수, 5/28=목, 5/29=금, 5/30=토, 5/31=일
    const dates = generateRepeatDates('2026-05-25', '2026-05-31', [1, 3, 5])
    expect(dates).toEqual(['2026-05-25', '2026-05-27', '2026-05-29'])
  })

  it('화목 2주', () => {
    const dates = generateRepeatDates('2026-06-01', '2026-06-14', [2, 4])
    expect(dates).toEqual(['2026-06-02', '2026-06-04', '2026-06-09', '2026-06-11'])
  })

  it('주말만', () => {
    const dates = generateRepeatDates('2026-05-25', '2026-05-31', [0, 6])
    expect(dates).toEqual(['2026-05-30', '2026-05-31'])
  })

  it('단일 요일 1개월', () => {
    // 2026-06 매주 월요일: 1, 8, 15, 22, 29
    const dates = generateRepeatDates('2026-06-01', '2026-06-30', [1])
    expect(dates).toEqual(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'])
  })

  it('weekday 미선택 → 빈 배열', () => {
    expect(generateRepeatDates('2026-05-25', '2026-05-31', [])).toEqual([])
  })

  it('start > end → 빈 배열', () => {
    expect(generateRepeatDates('2026-05-31', '2026-05-25', [1])).toEqual([])
  })

  it('잘못된 날짜 형식 → 빈 배열', () => {
    expect(generateRepeatDates('invalid', '2026-05-31', [1])).toEqual([])
  })

  it('2년 초과 범위 → 빈 배열 (안전 가드)', () => {
    expect(generateRepeatDates('2020-01-01', '2026-12-31', [1])).toEqual([])
  })

  it('start = end + 요일 일치 → 1건', () => {
    // 2026-05-25는 월요일
    expect(generateRepeatDates('2026-05-25', '2026-05-25', [1])).toEqual(['2026-05-25'])
  })

  it('start = end + 요일 불일치 → 0건', () => {
    expect(generateRepeatDates('2026-05-25', '2026-05-25', [3])).toEqual([])
  })
})
