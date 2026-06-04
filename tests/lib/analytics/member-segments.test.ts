import { describe, it, expect } from 'vitest'
import { findExpiringMembers, findDormantMembers, findLowRemainingMembers } from '@/lib/analytics/member-segments'
import type { Member } from '@/lib/supabase/members'
import type { Pass } from '@/lib/supabase/passes'

const m = (id: number, overrides: Partial<Member> = {}): Member => ({
  id, name: `회원${id}`, phone: null, email: null, gender: null,
  birthDate: null, address: null, detailAddress: null, memo: null,
  internalMemo: null, tier: null, appConnected: false,
  registeredAt: '2025-01-01', lastAttendedAt: '2026-04-01',
  ...overrides,
})

const p = (memberId: number, status: string, endDate: string | null, name = '개인', remaining = 5): Pass => ({
  id: 0, memberId, instructorId: null, passName: name, passType: '프라이빗',
  startDate: null, endDate, totalCount: 10, remainingCount: remaining, availableCount: remaining, cancellableCount: remaining,
  status, paymentType: '신규결제', paymentAmount: 650000,
  paidAt: '2026-01-01', paymentMethod: '카드', installment: null, isFamily: false,
  issuedAt: null, lastModifiedAt: null,
})

describe('findExpiringMembers', () => {
  it('7일 내 만료되는 이용중 패스만 추출', () => {
    const members = [m(1), m(2), m(3)]
    const passes = [
      p(1, '이용중', '2026-05-25'),  // today=2026-05-23, 2일 후 → 임박
      p(2, '이용중', '2026-06-15'),  // 23일 후 → 임박 아님
      p(3, '이용만료', '2026-05-25'),  // 만료라 제외
    ]
    const r = findExpiringMembers(members, passes, '2026-05-23', 7)
    expect(r).toHaveLength(1)
    expect(r[0].member.id).toBe(1)
    expect(r[0].daysUntilExpiry).toBe(2)
  })
})

describe('findLowRemainingMembers', () => {
  it('잔여 N회 이하 active 회원 추출 (회원당 최소 잔여, 오름차순)', () => {
    const members = [m(1), m(2), m(3)]
    const passes = [
      p(1, '이용중', '2026-12-31', '개인', 2),  // 잔여 2 ≤ 3 → 포함
      p(2, '이용중', '2026-12-31', '개인', 5),  // 잔여 5 > 3 → 제외
      p(3, '유효', '2026-12-31', '개인', 1),    // 임포트 status '유효' + 잔여1 → 포함
    ]
    const r = findLowRemainingMembers(members, passes, '2026-06-04', 3)
    expect(r.map(x => x.member.id)).toEqual([3, 1])  // 잔여 오름차순
    expect(r[0].remainingCount).toBe(1)
  })

  it('잔여 0(소진)·기간만료·종료상태는 제외', () => {
    const members = [m(1), m(2), m(3)]
    const passes = [
      p(1, '이용중', '2026-12-31', '개인', 0),  // 잔여 0 → 제외
      p(2, '이용중', '2026-05-01', '개인', 1),  // 기간 만료(today 2026-06-04) → 제외
      p(3, '환불', '2026-12-31', '개인', 1),    // 종료상태 → 제외
    ]
    expect(findLowRemainingMembers(members, passes, '2026-06-04', 3)).toHaveLength(0)
  })

  it('threshold 0이면 알림 끔', () => {
    expect(findLowRemainingMembers([m(1)], [p(1, '이용중', '2026-12-31', '개인', 1)], '2026-06-04', 0)).toHaveLength(0)
  })
})

describe('findDormantMembers', () => {
  it('60일 이상 미출석 회원만 추출', () => {
    const members = [
      m(1, { lastAttendedAt: '2026-05-01' }),  // today=2026-05-23, 22일 → 휴면 아님
      m(2, { lastAttendedAt: '2026-02-01' }),  // 111일 → 휴면
      m(3, { lastAttendedAt: null, registeredAt: '2026-01-01' }),  // 출석 없고 등록 142일 → 휴면
    ]
    const r = findDormantMembers(members, '2026-05-23', 60)
    expect(r.map(x => x.member.id).sort()).toEqual([2, 3])
  })
})
