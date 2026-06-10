import { describe, it, expect } from 'vitest'
import { computeGroupClosureStats, GROUP_CLOSURE_REASON } from '@/lib/analytics/instructor-scorecard'
import { resolvePeriodFull } from '@/lib/analytics/period'
import type { GroupSessionLite } from '@/lib/supabase/group-sessions'

function S(instructorId: number | null, category: string, active: boolean, cancelReason: string | null, lessonDate = '2026-03-10'): GroupSessionLite {
  return { instructorId, category, lessonDate, active, cancelReason }
}

describe('computeGroupClosureStats', () => {
  it('그룹 수업만 집계하고 인원부족 취소만 폐강으로 센다', () => {
    const sessions: GroupSessionLite[] = [
      S(1, '그룹', true, null),                  // 진행
      S(1, '그룹', false, GROUP_CLOSURE_REASON), // 폐강
      S(1, '그룹', false, '강사 사정'),           // 취소지만 폐강 아님
      S(1, '개인', false, GROUP_CLOSURE_REASON), // 그룹 아님 → 제외
      S(2, '그룹', true, null),
    ]
    const m = computeGroupClosureStats(sessions, null)
    expect(m.get(1)).toEqual({ total: 3, closed: 1 })
    expect(m.get(2)).toEqual({ total: 1, closed: 0 })
  })

  it('강사 미지정(null)은 제외', () => {
    const m = computeGroupClosureStats([S(null, '그룹', false, GROUP_CLOSURE_REASON)], null)
    expect(m.size).toBe(0)
  })

  it('그룹 수업이 없으면 빈 맵', () => {
    const m = computeGroupClosureStats([S(1, '개인', true, null)], null)
    expect(m.size).toBe(0)
  })

  it('이번달 폐강률은 월말까지 포함 — 미래 일정·미래 폐강도 집계 (period-to-date 버그 수정)', () => {
    // 오늘=6/10 기준. 매출용 resolvePeriod였다면 6/18·6/30이 잘려 0/3이 됐을 케이스.
    const period = resolvePeriodFull('month', '2026-06-10')
    const sessions = [
      S(1, '그룹', true, null, '2026-06-05'),                  // 과거 진행
      S(1, '그룹', false, GROUP_CLOSURE_REASON, '2026-06-18'), // 미래 폐강
      S(1, '그룹', true, null, '2026-06-30'),                  // 미래 진행
      S(1, '그룹', true, null, '2026-07-02'),                  // 다음달 → 제외
    ]
    const m = computeGroupClosureStats(sessions, period)
    expect(m.get(1)).toEqual({ total: 3, closed: 1 }) // 6월 3건 중 1건 폐강 = 33%
  })
})
