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

  // ── 과거 임포트 데이터 버그 수정: status 문자열에 의존하지 않고 잔여+기간으로 판정 ──
  it('status가 빈값/null이어도 잔여>0 & 기간 유효면 usable (임포트 데이터)', () => {
    expect(evaluatePassGuard([pass({ status: null })], today).usable).toBe(true)
    expect(evaluatePassGuard([pass({ status: '' })], today).usable).toBe(true)
  })

  it("status '유효'·'활성' 같은 다른 표기도 잔여+기간 멀쩡하면 usable", () => {
    expect(evaluatePassGuard([pass({ status: '유효' })], today).usable).toBe(true)
    expect(evaluatePassGuard([pass({ status: '활성' })], today).usable).toBe(true)
    expect(evaluatePassGuard([pass({ status: '사용중' })], today).usable).toBe(true)
  })

  it('명시적 종료/무효 상태(환불·정지·양도·해지)는 기간·잔여 멀쩡해도 차단', () => {
    expect(evaluatePassGuard([pass({ status: '환불' })], today).usable).toBe(false)
    expect(evaluatePassGuard([pass({ status: '정지' })], today).usable).toBe(false)
    expect(evaluatePassGuard([pass({ status: '양도' })], today).usable).toBe(false)
    expect(evaluatePassGuard([pass({ status: '해지' })], today).usable).toBe(false)
  })

  it("그래도 '이용기간 지남'·'잔여 0'은 status 무관하게 만료", () => {
    expect(evaluatePassGuard([pass({ status: '유효', endDate: '2026-05-31' })], today).usable).toBe(false)
    expect(evaluatePassGuard([pass({ status: '유효', remainingCount: 0 })], today).usable).toBe(false)
  })
})
