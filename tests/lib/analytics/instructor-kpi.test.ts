import { describe, it, expect } from 'vitest'
import { computeInstructorKPI, computeOverallTrialConversion, groupPassesByMember } from '@/lib/analytics/instructor-kpi'
import type { Pass } from '@/lib/supabase/passes'

function p(opts: Partial<Pass> & { memberId: number; passName: string }): Pass {
  return {
    id: opts.id ?? 0,
    memberId: opts.memberId,
    instructorId: opts.instructorId ?? null,
    passName: opts.passName,
    passType: opts.passType ?? '프라이빗',
    startDate: opts.startDate ?? null,
    endDate: opts.endDate ?? null,
    totalCount: opts.totalCount ?? null,
    remainingCount: opts.remainingCount ?? null,
    availableCount: opts.availableCount ?? null,
    cancellableCount: opts.cancellableCount ?? null,
    status: opts.status ?? '이용중',
    paymentType: opts.paymentType ?? '신규결제',
    paymentAmount: opts.paymentAmount ?? null,
    paidAt: opts.paidAt ?? null,
    paymentMethod: opts.paymentMethod ?? null,
    installment: opts.installment ?? null,
    isFamily: opts.isFamily ?? false,
    issuedAt: opts.issuedAt ?? null,
    lastModifiedAt: opts.lastModifiedAt ?? null,
  }
}

describe('groupPassesByMember', () => {
  it('회원별로 그룹화 + paid_at 오름차순', () => {
    const all = [
      p({ memberId: 1, passName: '개인', paidAt: '2025-03-01' }),
      p({ memberId: 1, passName: '체험', paidAt: '2025-01-01' }),
      p({ memberId: 2, passName: '체험', paidAt: '2025-02-01' }),
    ]
    const map = groupPassesByMember(all)
    expect(map.size).toBe(2)
    expect(map.get(1)![0].passName).toBe('체험')
    expect(map.get(1)![1].passName).toBe('개인')
  })
})

describe('computeOverallTrialConversion', () => {
  it('체험 → 정회원 전환 비율 계산', () => {
    const map = new Map<number, Pass[]>()
    map.set(1, [
      p({ memberId: 1, passName: '체험', paidAt: '2025-01-01' }),
      p({ memberId: 1, passName: '개인', paidAt: '2025-02-01' }),
    ])  // 전환됨
    map.set(2, [
      p({ memberId: 2, passName: '체험', paidAt: '2025-01-01' }),
    ])  // 체험만 (전환 X)
    map.set(3, [
      p({ memberId: 3, passName: '개인', paidAt: '2025-01-01' }),
    ])  // 체험 안 함

    const result = computeOverallTrialConversion(map)
    expect(result.trialCount).toBe(2)
    expect(result.convertedCount).toBe(1)
    expect(result.rate).toBe(0.5)
  })

  it('체험 없으면 trialCount=0, rate=0', () => {
    const map = new Map<number, Pass[]>()
    map.set(1, [p({ memberId: 1, passName: '개인' })])
    const result = computeOverallTrialConversion(map)
    expect(result.trialCount).toBe(0)
    expect(result.rate).toBe(0)
  })
})

describe('computeInstructorKPI', () => {
  it('매출 합계 + 회원수 + 활성 회원', () => {
    const instructorId = 5
    const passes = [
      p({ memberId: 1, passName: '개인', paymentAmount: 650000, status: '이용중', instructorId: 5 }),
      p({ memberId: 2, passName: '개인', paymentAmount: 650000, status: '이용만료', instructorId: 5 }),
      p({ memberId: 1, passName: '재활', paymentAmount: 770000, status: '이용만료', instructorId: 5 }),
    ]
    const allByMember = groupPassesByMember(passes)
    const kpi = computeInstructorKPI(instructorId, passes, allByMember)
    expect(kpi.totalRevenue).toBe(650000 + 650000 + 770000)
    expect(kpi.totalMemberCount).toBe(2)  // 회원 1, 2
    expect(kpi.activeMemberCount).toBe(1)  // 회원 1만 이용중
  })

  it('재등록률: 2회+ 결제한 회원 비율', () => {
    const instructorId = 5
    const passes = [
      p({ memberId: 1, passName: '개인', paidAt: '2025-01-01', instructorId: 5 }),
      p({ memberId: 1, passName: '개인', paidAt: '2025-04-01', instructorId: 5 }),  // 2회
      p({ memberId: 2, passName: '개인', paidAt: '2025-01-01', instructorId: 5 }),  // 1회
      p({ memberId: 3, passName: '개인', paidAt: '2025-01-01', instructorId: 5 }),
      p({ memberId: 3, passName: '개인', paidAt: '2025-04-01', instructorId: 5 }),
      p({ memberId: 3, passName: '개인', paidAt: '2025-07-01', instructorId: 5 }),  // 3회
    ]
    const allByMember = groupPassesByMember(passes)
    const kpi = computeInstructorKPI(instructorId, passes, allByMember)
    expect(kpi.totalMemberCount).toBe(3)
    expect(kpi.reregistrationRate).toBeCloseTo(2/3, 5)  // 회원 1, 3 재등록
  })

  it('전환율: 첫 pass가 체험인 회원의 정회원 전환 비율', () => {
    const instructorId = 5
    const allPasses = [
      // 회원 1: 체험 → 정회원 (전환)
      p({ memberId: 1, passName: '체험', paidAt: '2025-01-01' }),
      p({ memberId: 1, passName: '개인', paidAt: '2025-02-01', instructorId: 5 }),
      // 회원 2: 체험만 (전환 X)
      p({ memberId: 2, passName: '체험', paidAt: '2025-01-01', instructorId: 5 }),  // 강사가 체험 담당
      // 회원 3: 처음부터 정회원 (강사 5 담당)
      p({ memberId: 3, passName: '개인', paidAt: '2025-01-01', instructorId: 5 }),
    ]
    // 이 강사의 passes만 필터 (회원 1의 개인, 회원 2의 체험, 회원 3의 개인)
    const instructorPasses = allPasses.filter(p => p.instructorId === 5)
    const allByMember = groupPassesByMember(allPasses)
    const kpi = computeInstructorKPI(instructorId, instructorPasses, allByMember)
    // 강사 담당: 회원 1, 2, 3
    // 회원 1: 첫 pass 체험, 정회원 있음 → 전환
    // 회원 2: 첫 pass 체험, 정회원 없음 → 미전환
    // 회원 3: 첫 pass 정회원 → trial 아님
    expect(kpi.trialMemberCount).toBe(2)
    expect(kpi.convertedMemberCount).toBe(1)
    expect(kpi.trialConversionRate).toBe(0.5)
  })

  it('빈 입력: 모든 값 0', () => {
    const kpi = computeInstructorKPI(5, [], new Map())
    expect(kpi.totalRevenue).toBe(0)
    expect(kpi.totalMemberCount).toBe(0)
    expect(kpi.activeMemberCount).toBe(0)
    expect(kpi.reregistrationRate).toBe(0)
    expect(kpi.trialConversionRate).toBe(0)
  })
})
