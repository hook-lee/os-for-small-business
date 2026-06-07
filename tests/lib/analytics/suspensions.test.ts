import { describe, it, expect } from 'vitest'
import {
  inclusiveDays, addDays, currentSuspension, totalSuspendDays, remainingSuspendDays,
  type Suspension,
} from '@/lib/analytics/suspensions'

const sus = (id: number, start: string, end: string, days: number): Suspension => ({
  id, passId: 1, startDate: start, endDate: end, days, reason: null, createdAt: '2026-01-01T00:00:00Z',
})

describe('inclusiveDays', () => {
  it('5/1~5/8 = 8일 (양끝 포함)', () => {
    expect(inclusiveDays('2026-05-01', '2026-05-08')).toBe(8)
  })
  it('같은 날 = 1일', () => {
    expect(inclusiveDays('2026-05-01', '2026-05-01')).toBe(1)
  })
  it('종료가 시작보다 빠르면 0 이하', () => {
    expect(inclusiveDays('2026-05-08', '2026-05-01')).toBeLessThanOrEqual(0)
  })
  it('월 경계 넘김', () => {
    expect(inclusiveDays('2026-06-28', '2026-07-02')).toBe(5)
  })
})

describe('addDays (만료일 연장)', () => {
  it('만료일 + 정지일수', () => {
    expect(addDays('2026-07-05', 8)).toBe('2026-07-13')
  })
  it('월 경계', () => {
    expect(addDays('2026-06-28', 5)).toBe('2026-07-03')
  })
})

describe('currentSuspension', () => {
  const list = [sus(1, '2026-05-01', '2026-05-08', 8), sus(2, '2026-07-01', '2026-07-10', 10)]
  it('정지 구간 안이면 그 정지 반환', () => {
    expect(currentSuspension(list, '2026-07-05')?.id).toBe(2)
  })
  it('경계일 포함', () => {
    expect(currentSuspension(list, '2026-05-01')?.id).toBe(1)
    expect(currentSuspension(list, '2026-05-08')?.id).toBe(1)
  })
  it('정지 구간 밖이면 null', () => {
    expect(currentSuspension(list, '2026-06-15')).toBeNull()
  })
})

describe('누적/잔여 정지일수', () => {
  const list = [sus(1, '2026-05-01', '2026-05-08', 8), sus(2, '2026-07-01', '2026-07-10', 10)]
  it('누적 = 합', () => {
    expect(totalSuspendDays(list)).toBe(18)
  })
  it('잔여 = 최대 - 누적', () => {
    expect(remainingSuspendDays(list, 30)).toBe(12)
  })
  it('초과 시 0 (음수 X)', () => {
    expect(remainingSuspendDays(list, 10)).toBe(0)
  })
  it('최대 0 = 무제한', () => {
    expect(remainingSuspendDays(list, 0)).toBe(Infinity)
  })
})
