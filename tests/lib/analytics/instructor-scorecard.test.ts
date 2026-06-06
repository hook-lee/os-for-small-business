import { describe, it, expect } from 'vitest'
import { computeInstructorScorecards, type IncentiveSetting } from '@/lib/analytics/instructor-scorecard'
import { groupPassesByMember } from '@/lib/analytics/instructor-kpi'
import { resolvePeriod } from '@/lib/analytics/period'
import type { Pass } from '@/lib/supabase/passes'
import type { Instructor } from '@/lib/supabase/instructors'

function inst(id: number, name: string, role: Instructor['role'] = 'instructor'): Instructor {
  return {
    id, name, phone: null, email: null, role,
    employmentType: null, defaultHourlyRate: 0,
    ratePrivate: 0, rateRehab: 0, rateDuet: 0, rateGroup: 0,
    color: null, active: true, authUserId: null,
  }
}

let pid = 1
function p(
  memberId: number,
  instructorId: number | null,
  passName: string,
  paidAt: string | null,
  paymentAmount: number,
  status: string | null = '이용만료',
): Pass {
  return {
    id: pid++, memberId, instructorId, passName,
    passType: null, startDate: paidAt, endDate: null,
    totalCount: 10, remainingCount: 0, availableCount: 0, cancellableCount: 0,
    status, paymentType: null, paymentAmount, paidAt,
    paymentMethod: '카드', installment: null, isFamily: false,
    issuedAt: paidAt, lastModifiedAt: null,
  }
}

// 시나리오:
//  강사1: 회원100 체험(1월) → 정회원(2월), 회원101 정회원(6월, 이용중)
//  강사2: 회원102 정회원(3월)
function buildData() {
  const instructors = [inst(1, '김유진', 'owner'), inst(2, '박서연')]
  const passes: Pass[] = [
    p(100, 1, '체험 1회', '2026-01-10', 50_000),
    p(100, 1, '프라이빗 10회', '2026-02-10', 500_000),
    p(101, 1, '프라이빗 10회', '2026-06-05', 700_000, '이용중'),
    p(102, 2, '그룹 10회', '2026-03-20', 300_000, '이용중'),
  ]
  const allByMember = groupPassesByMember(passes)
  return { instructors, passes, allByMember }
}

const NO_RATES = new Map<number, IncentiveSetting[]>()

describe('computeInstructorScorecards', () => {
  it("기간 '이번달'(6월): 강사1은 회원101 신규 1명·매출 70만, 재등록 0", () => {
    const { instructors, passes, allByMember } = buildData()
    const period = resolvePeriod('month', '2026-06-15')
    const rows = computeInstructorScorecards(instructors, passes, allByMember, period, NO_RATES)
    const r1 = rows.find(r => r.instructorId === 1)!
    expect(r1.revenue).toBe(700_000)
    expect(r1.newMembers).toBe(1)
    expect(r1.reregistrationCount).toBe(0)
  })

  it("기간 '누적': 강사1 매출=전체합, 신규 2명, 재등록 1건", () => {
    const { instructors, passes, allByMember } = buildData()
    const rows = computeInstructorScorecards(instructors, passes, allByMember, null, NO_RATES)
    const r1 = rows.find(r => r.instructorId === 1)!
    expect(r1.revenue).toBe(50_000 + 500_000 + 700_000)
    expect(r1.newMembers).toBe(2)         // 회원100(체험 1월), 회원101(6월)
    expect(r1.reregistrationCount).toBe(1) // 회원100 정회원(2월) = 재결제
  })

  it('누적 비율: 강사1 재등록률 0.5, 전환율 1.0, 활성 1명', () => {
    const { instructors, passes, allByMember } = buildData()
    const rows = computeInstructorScorecards(instructors, passes, allByMember, null, NO_RATES)
    const r1 = rows.find(r => r.instructorId === 1)!
    expect(r1.reregistrationRate).toBeCloseTo(0.5)   // 2명 중 1명(회원100) 2회+
    expect(r1.trialConversionRate).toBeCloseTo(1.0)  // 체험 1명 → 전환 1명
    expect(r1.trialMemberCount).toBe(1)
    expect(r1.convertedMemberCount).toBe(1)
    expect(r1.activeMembers).toBe(1)                 // 회원101 '이용중'
    expect(r1.totalMembers).toBe(2)
  })

  it('비율/스냅샷은 기간과 무관 (이번달 탭에서도 누적 동일)', () => {
    const { instructors, passes, allByMember } = buildData()
    const month = computeInstructorScorecards(instructors, passes, allByMember, resolvePeriod('month', '2026-06-15'), NO_RATES)
    const all = computeInstructorScorecards(instructors, passes, allByMember, null, NO_RATES)
    const m1 = month.find(r => r.instructorId === 1)!
    const a1 = all.find(r => r.instructorId === 1)!
    expect(m1.reregistrationRate).toBe(a1.reregistrationRate)
    expect(m1.trialConversionRate).toBe(a1.trialConversionRate)
    expect(m1.activeMembers).toBe(a1.activeMembers)
  })

  it('인센티브 요약: 회당>0 회원만 집계, min/max', () => {
    const { instructors, passes, allByMember } = buildData()
    const rates = new Map<number, IncentiveSetting[]>([
      [1, [{ incentivePerSession: 12_000 }, { incentivePerSession: 0 }, { incentivePerSession: 5_000 }]],
    ])
    const rows = computeInstructorScorecards(instructors, passes, allByMember, null, rates)
    const r1 = rows.find(r => r.instructorId === 1)!
    expect(r1.incentive.memberCount).toBe(2)        // 0원 제외
    expect(r1.incentive.perSessionMin).toBe(5_000)
    expect(r1.incentive.perSessionMax).toBe(12_000)
    expect(r1.incentive.hasAny).toBe(true)
    const r2 = rows.find(r => r.instructorId === 2)!
    expect(r2.incentive.hasAny).toBe(false)         // 설정 없음
    expect(r2.incentive.memberCount).toBe(0)
  })

  it('빈 입력 — 강사는 모두 0', () => {
    const rows = computeInstructorScorecards([inst(1, 'A')], [], new Map(), null, NO_RATES)
    expect(rows).toHaveLength(1)
    expect(rows[0].revenue).toBe(0)
    expect(rows[0].newMembers).toBe(0)
    expect(rows[0].activeMembers).toBe(0)
    expect(rows[0].reregistrationRate).toBe(0)
  })
})
