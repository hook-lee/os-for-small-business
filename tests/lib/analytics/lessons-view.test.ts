import { describe, it, expect } from 'vitest'
import {
  getRangeForView,
  groupByDate,
  countByDate,
  getWeekDates,
  buildMonthGrid,
  sortByTime,
  lessonTypeLabel,
  groupByTimeSlot,
} from '@/lib/analytics/lessons-view'
import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'

function ind(date: string, time: string | null, passName: string | null = '개인'): UnifiedLesson {
  return {
    id: Math.floor(Math.random() * 100000),
    type: 'individual',
    date,
    time,
    durationMinutes: 50,
    instructorId: null,
    instructorName: '강사',
    memberId: 1,
    memberName: '회원',
    passName,
    status: 'scheduled',
    sessionName: null,
    capacity: null,
    reservedCount: null,
  }
}
function grp(date: string, time: string, sessionName = '월수금 10시'): UnifiedLesson {
  return {
    id: Math.floor(Math.random() * 100000),
    type: 'group',
    date,
    time,
    durationMinutes: 50,
    instructorId: null,
    instructorName: '강사',
    memberId: null,
    memberName: null,
    passName: null,
    status: null,
    sessionName,
    capacity: 4,
    reservedCount: 2,
  }
}

describe('getRangeForView', () => {
  it('일별 = 같은 날', () => {
    expect(getRangeForView('일별', '2026-05-15')).toEqual({ start: '2026-05-15', end: '2026-05-15' })
  })

  it('주별 = 일요일 ~ 토요일', () => {
    // 2026-05-15는 금요일
    const r = getRangeForView('주별', '2026-05-15')
    expect(r.start).toBe('2026-05-10')   // 일
    expect(r.end).toBe('2026-05-16')     // 토
  })

  it('월별 = 1일 ~ 말일', () => {
    expect(getRangeForView('월별', '2026-05-15')).toEqual({ start: '2026-05-01', end: '2026-05-31' })
  })

  it('월별: 2월 (28/29일)', () => {
    expect(getRangeForView('월별', '2026-02-15')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
})

describe('groupByDate / countByDate', () => {
  it('날짜별 group + count', () => {
    const lessons = [
      ind('2026-05-15', '10:00'),
      ind('2026-05-15', '11:00'),
      grp('2026-05-15', '14:00'),
      ind('2026-05-16', '09:00'),
    ]
    const g = groupByDate(lessons)
    expect(g.get('2026-05-15')?.length).toBe(3)
    expect(g.get('2026-05-16')?.length).toBe(1)

    const c = countByDate(lessons)
    expect(c.get('2026-05-15')).toEqual({ date: '2026-05-15', individual: 2, group: 1, total: 3 })
    expect(c.get('2026-05-16')).toEqual({ date: '2026-05-16', individual: 1, group: 0, total: 1 })
  })
})

describe('getWeekDates', () => {
  it('일요일부터 토요일까지 7일', () => {
    expect(getWeekDates('2026-05-10')).toEqual([
      '2026-05-10', '2026-05-11', '2026-05-12', '2026-05-13',
      '2026-05-14', '2026-05-15', '2026-05-16',
    ])
  })

  it('월말 → 다음달로 넘어감', () => {
    const w = getWeekDates('2026-05-31')   // 일요일
    expect(w).toEqual([
      '2026-05-31', '2026-06-01', '2026-06-02', '2026-06-03',
      '2026-06-04', '2026-06-05', '2026-06-06',
    ])
  })
})

describe('buildMonthGrid', () => {
  it('2026-05: 35칸 (5주), 1일이 금요일', () => {
    const grid = buildMonthGrid('2026-05')
    const all = grid.flat()
    const nonNull = all.filter(c => c.date !== null)
    expect(nonNull.length).toBe(31)
    // 5월 1일은 금요일 → index 5
    expect(all.findIndex(c => c.date === '2026-05-01')).toBe(5)
  })
})

describe('groupByTimeSlot — 룸 처리 (같은 시간 묶기)', () => {
  it('같은 시간 lessons는 같은 그룹에 묶임', () => {
    const txs = [
      ind('2026-05-15', '20:00'),    // 룸 1
      grp('2026-05-15', '20:00'),    // 룸 2
      ind('2026-05-15', '21:00'),    // 다른 시간
    ]
    const groups = groupByTimeSlot(txs)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toHaveLength(2)   // 20:00에 2개 (룸 2개 동시)
    expect(groups[1]).toHaveLength(1)   // 21:00에 1개
  })

  it('시간순 정렬', () => {
    const txs = [
      ind('2026-05-15', '20:00'),
      ind('2026-05-15', '09:00'),
      ind('2026-05-15', '14:30'),
    ]
    const groups = groupByTimeSlot(txs)
    expect(groups.map(g => g[0].time)).toEqual(['09:00', '14:30', '20:00'])
  })

  it('빈 입력 → 빈 배열', () => {
    expect(groupByTimeSlot([])).toEqual([])
  })
})

describe('sortByTime + lessonTypeLabel', () => {
  it('시간순 정렬', () => {
    const sorted = sortByTime([
      ind('2026-05-15', '14:00'),
      ind('2026-05-15', '09:00'),
      ind('2026-05-15', '11:30'),
    ])
    expect(sorted.map(l => l.time)).toEqual(['09:00', '11:30', '14:00'])
  })

  it('lessonTypeLabel', () => {
    expect(lessonTypeLabel(ind('2026-05-15', '10:00', '재활'))).toBe('재활')
    expect(lessonTypeLabel(ind('2026-05-15', '10:00', null))).toBe('개인')
    expect(lessonTypeLabel(grp('2026-05-15', '14:00', '월수금 10시'))).toBe('그룹 · 월수금 10시')
  })
})
