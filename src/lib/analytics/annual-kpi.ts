/**
 * 연간 KPI — 올해 목표 대시보드용 6개 지표.
 *
 * 사용자가 고른 6개 (보수적·데이터 기반):
 *  1. 연 매출        (revenue)              — 올해 1~12월 매출 누적 (transactions '매출')
 *  2. 순이익          (netProfit)            — 올해 영업이익 - 개인비용 누적
 *  3. 활성 회원 수    (activeMembers)        — 현재 '이용중' + 잔여 + 미만료 pass 보유 회원 (unique)
 *  4. 신규 회원 수    (newMembers)           — 올해 등록(registered_at)한 회원
 *  5. 체험→등록 전환율 (trialConversionRate)  — 첫 pass가 '체험'인 회원 중 정회원 pass로 이어진 비율
 *  6. 재등록률        (reregistrationRate)   — 결제 경험 회원 중 2회 이상 결제한 비율
 *
 * ⚠️ 모두 pure 함수. 특정 센터 전용 로직 없음 — 어느 원장 데이터든 동일하게 계산.
 * 매출·순이익·신규회원은 '올해' 범위. 활성회원·전환율·재등록률은 '현재 누적' 상태값.
 */
import type { Transaction } from '@/types/domain'
import type { Member } from '@/lib/supabase/members'
import type { Pass } from '@/lib/supabase/passes'
import { computeMonthlySummary } from './monthly-summary'
import { computeOverallTrialConversion, groupPassesByMember } from './instructor-kpi'
import { findActivePasses } from './member-status'

export interface AnnualKPIs {
  year: number
  revenue: number            // 올해 매출 누적 (원)
  netProfit: number          // 올해 순이익 누적 (원)
  activeMembers: number      // 현재 활성 회원 (명)
  newMembers: number         // 올해 신규 등록 회원 (명)
  trialConversionRate: number  // 0~1
  trialDetail: { trialCount: number; convertedCount: number }
  reregistrationRate: number   // 0~1
  reregistrationDetail: { repeatMembers: number; payingMembers: number }
}

export function computeAnnualKPIs(
  year: number,
  today: string,
  data: { transactions: Transaction[]; members: Member[]; passes: Pass[] },
): AnnualKPIs {
  const { transactions, members, passes } = data

  // 1·2. 매출·순이익 — 올해 1~12월 합
  let revenue = 0
  let netProfit = 0
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`
    const s = computeMonthlySummary(transactions, ym)
    revenue += s.revenue
    netProfit += s.netProfit
  }

  // 3. 활성 회원 — 현재 사용 가능한 pass 보유 (canonical: member-status.findActivePasses)
  const passLikes = passes.map(p => ({
    memberId: p.memberId,
    status: p.status,
    remainingCount: p.remainingCount,
    endDate: p.endDate,
    startDate: p.startDate,
    passType: p.passType,
    passName: p.passName,
  }))
  const activeIds = new Set<number>()
  for (const p of findActivePasses(passLikes, today)) activeIds.add(p.memberId)
  const activeMembers = activeIds.size

  // 4. 신규 회원 — 올해 등록
  const yearPrefix = String(year)
  const newMembers = members.filter(m => (m.registeredAt ?? '').startsWith(yearPrefix)).length

  // 5. 체험→등록 전환율
  const byMember = groupPassesByMember(passes)
  const conv = computeOverallTrialConversion(byMember)

  // 6. 재등록률 — 결제(payment_amount>0) 경험 회원 중 2회 이상 결제 비율
  let repeatMembers = 0
  let payingMembers = 0
  for (const [, ps] of byMember) {
    const paid = ps.filter(p => (p.paymentAmount ?? 0) > 0)
    if (paid.length === 0) continue
    payingMembers++
    if (paid.length >= 2) repeatMembers++
  }
  const reregistrationRate = payingMembers === 0 ? 0 : repeatMembers / payingMembers

  return {
    year,
    revenue,
    netProfit,
    activeMembers,
    newMembers,
    trialConversionRate: conv.rate,
    trialDetail: { trialCount: conv.trialCount, convertedCount: conv.convertedCount },
    reregistrationRate,
    reregistrationDetail: { repeatMembers, payingMembers },
  }
}

/**
 * 목표 대비 달성률 (0~1+, 초과 가능). 목표 미설정(null/0)이면 null.
 */
export function achievementRate(actual: number, goal: number | null | undefined): number | null {
  if (goal == null || goal <= 0) return null
  return actual / goal
}
