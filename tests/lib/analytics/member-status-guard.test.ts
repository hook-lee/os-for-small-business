import { describe, it, expect } from 'vitest'
import { evaluatePassGuard } from '@/lib/analytics/member-status'
import type { PassLike } from '@/lib/analytics/member-status'

function pass(over: Partial<PassLike>): PassLike {
  return {
    memberId: 1,
    status: '이용중',
    remainingCount: 5,
    endDate: '2026-12-31',
    startDate: '2026-01-01',
    passType: '프라이빗',
    passName: '프라이빗 10회',
    ...over,
  }
}

describe('evaluatePassGuard', () => {
  const today = '2026-06-03'

  it('사용 가능한 수강권 있으면 usable', () => {
    const g = evaluatePassGuard([pass({})], today)
    expect(g.usable).toBe(true)
    expect(g.status).toBe('active')
  })

  it('수강권이 아예 없으면 차단 + 사유', () => {
    const g = evaluatePassGuard([], today)
    expect(g.usable).toBe(false)
    expect(g.status).toBe('no_pass')
    expect(g.reason).toContain('수강권')
  })

  it('잔여 0회면 차단 (무료 수업 위험)', () => {
    const g = evaluatePassGuard([pass({ remainingCount: 0 })], today)
    expect(g.usable).toBe(false)
    expect(g.status).toBe('expired')
  })

  it('이용기간 만료(endDate 지남)면 차단', () => {
    const g = evaluatePassGuard([pass({ endDate: '2026-05-31' })], today)
    expect(g.usable).toBe(false)
    expect(g.status).toBe('expired')
    expect(g.reason).toContain('만료')
  })

  it("상태가 '이용만료'면 차단", () => {
    const g = evaluatePassGuard([pass({ status: '이용만료' })], today)
    expect(g.usable).toBe(false)
  })

  it('만료 pass + 유효 pass 동시 보유면 usable (하나라도 살아있으면 OK)', () => {
    const g = evaluatePassGuard([pass({ remainingCount: 0 }), pass({ remainingCount: 3 })], today)
    expect(g.usable).toBe(true)
  })
})
