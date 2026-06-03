import { describe, it, expect } from 'vitest'
import { computeAnnualKPIs, achievementRate } from '@/lib/analytics/annual-kpi'
import type { Transaction, TxClassification } from '@/types/domain'
import type { Member } from '@/lib/supabase/members'
import type { Pass } from '@/lib/supabase/passes'

function tx(
  date: string,
  category: string,
  amount: number,
  classification: TxClassification = amount > 0 ? 'business' : 'living',
): Transaction {
  return {
    date,
    rawCategory: category,
    category: category as Transaction['category'],
    amount,
    method: '카드',
    counterparty: undefined,
    person: undefined,
    classification,
    memo: undefined,
  } as Transaction
}

function member(id: number, registeredAt: string | null): Member {
  return {
    id,
    name: `회원${id}`,
    phone: null, email: null, gender: null, birthDate: null,
    address: null, detailAddress: null, memo: null, internalMemo: null,
    tier: null, appConnected: false,
    registeredAt,
    lastAttendedAt: null,
  }
}

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

describe('computeAnnualKPIs', () => {
  it('매출·순이익은 올해 1~12월만 누적', () => {
    const txs = [
      tx('2026-03-01', '매출', 1_000_000),
      tx('2026-07-01', '매출', 2_000_000),
      tx('2025-12-01', '매출', 9_000_000),   // 작년 — 제외
      tx('2026-03-05', '임대료', -500_000, 'business'),  // 사업비용 → 영업이익/순이익 차감
      tx('2026-03-06', '생활비', -300_000, 'living'),    // 개인비용 → 순이익만 차감
    ]
    const kpi = computeAnnualKPIs(2026, '2026-06-03', { transactions: txs, members: [], passes: [] })
    expect(kpi.revenue).toBe(3_000_000)
    // 영업이익 = 3,000,000 - 500,000 = 2,500,000 ; 순이익 = 2,500,000 - 300,000
    expect(kpi.netProfit).toBe(2_200_000)
  })

  it('활성 회원 = 이용중 + 잔여 + 미만료 pass 보유 unique', () => {
    const passes = [
      p({ memberId: 1, passName: '개인', status: '이용중', remainingCount: 5, endDate: '2026-12-31' }),
      p({ memberId: 1, passName: '재활', status: '이용중', remainingCount: 3, endDate: '2026-12-31' }), // 중복 회원
      p({ memberId: 2, passName: '개인', status: '이용중', remainingCount: 0, endDate: '2026-12-31' }), // 잔여 0 → 비활성
      p({ memberId: 3, passName: '개인', status: '이용중', remainingCount: 5, endDate: '2026-01-01' }), // 만료 → 비활성
      p({ memberId: 4, passName: '개인', status: '이용만료', remainingCount: 5, endDate: '2026-12-31' }), // 상태 만료
    ]
    const kpi = computeAnnualKPIs(2026, '2026-06-03', { transactions: [], members: [], passes })
    expect(kpi.activeMembers).toBe(1)  // 회원 1만
  })

  it('신규 회원 = 올해 등록한 회원만', () => {
    const members = [
      member(1, '2026-01-15'),
      member(2, '2026-05-20'),
      member(3, '2025-11-01'),  // 작년 — 제외
      member(4, null),          // 등록일 없음 — 제외
    ]
    const kpi = computeAnnualKPIs(2026, '2026-06-03', { transactions: [], members, passes: [] })
    expect(kpi.newMembers).toBe(2)
  })

  it('전환율 + 재등록률', () => {
    const passes = [
      // 회원 1: 체험 → 정회원 2회 결제 (전환 O, 재등록 O)
      p({ memberId: 1, passName: '체험', paidAt: '2026-01-01', paymentAmount: 0 }),
      p({ memberId: 1, passName: '개인', paidAt: '2026-02-01', paymentAmount: 650_000 }),
      p({ memberId: 1, passName: '개인', paidAt: '2026-05-01', paymentAmount: 650_000 }),
      // 회원 2: 체험만 (전환 X), 결제 0건 → paying 아님
      p({ memberId: 2, passName: '체험', paidAt: '2026-01-01', paymentAmount: 0 }),
      // 회원 3: 정회원 1회만 (전환 대상 아님, 재등록 X)
      p({ memberId: 3, passName: '개인', paidAt: '2026-01-01', paymentAmount: 500_000 }),
    ]
    const kpi = computeAnnualKPIs(2026, '2026-06-03', { transactions: [], members: [], passes })
    // 체험 첫 pass: 회원 1, 2 → trialCount 2, 전환 회원 1 → 0.5
    expect(kpi.trialDetail.trialCount).toBe(2)
    expect(kpi.trialDetail.convertedCount).toBe(1)
    expect(kpi.trialConversionRate).toBe(0.5)
    // 결제 경험: 회원 1(2건), 회원 3(1건) → paying 2 ; 2건+ : 회원 1 → 0.5
    expect(kpi.reregistrationDetail.payingMembers).toBe(2)
    expect(kpi.reregistrationDetail.repeatMembers).toBe(1)
    expect(kpi.reregistrationRate).toBe(0.5)
  })

  it('빈 입력: 모두 0', () => {
    const kpi = computeAnnualKPIs(2026, '2026-06-03', { transactions: [], members: [], passes: [] })
    expect(kpi.revenue).toBe(0)
    expect(kpi.netProfit).toBe(0)
    expect(kpi.activeMembers).toBe(0)
    expect(kpi.newMembers).toBe(0)
    expect(kpi.trialConversionRate).toBe(0)
    expect(kpi.reregistrationRate).toBe(0)
  })
})

describe('achievementRate', () => {
  it('목표 미설정(null/0)이면 null', () => {
    expect(achievementRate(100, null)).toBe(null)
    expect(achievementRate(100, 0)).toBe(null)
  })
  it('달성률 = 실적/목표 (초과 가능)', () => {
    expect(achievementRate(50, 100)).toBe(0.5)
    expect(achievementRate(120, 100)).toBe(1.2)
  })
})
