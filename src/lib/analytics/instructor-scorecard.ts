import type { Pass } from '@/lib/supabase/passes'
import type { Instructor } from '@/lib/supabase/instructors'
import { computeInstructorKPI, groupPassesByMember } from './instructor-kpi'
import { isInPeriod, type PeriodRange } from './period'

/**
 * 강사 성과 비교 (원장용). 기존 computeInstructorKPI(누적)와 별개로,
 * "기간 흐름 지표"를 추가해 인센티브 판단용으로 강사들을 한 화면에서 비교한다.
 *
 * 설계(2026-06-03 spec): 기간이 바꾸는 건 **흐름(합계·건수)**뿐.
 *  - 매출(강사 귀속)·신규 회원·재등록 건수 = period-scoped (paidAt 기준)
 *  - 전환율·재등록률 = 누적 비율 (코호트라 단기 기간은 오해 유발 → 누적 고정, 라벨 '누적')
 *  - 활성 회원 = 현재 이용중 스냅샷 (기간 무관, 라벨 '현재')
 *
 * '매출'은 스튜디오 매출 통계(transactions)가 아니라 **강사 귀속 결제액** attribution.
 * (기존 강사 목록 revenueByInstructor·상세 KPI와 동일 기준.)
 */

export interface InstructorIncentiveSummary {
  memberCount: number          // 회당 인센티브(>0)가 설정된 담당 회원 수
  perSessionMin: number | null // 회당 인센티브 최소 (원)
  perSessionMax: number | null // 회당 인센티브 최대 (원)
  hasAny: boolean
}

export interface InstructorScorecardRow {
  instructorId: number
  instructorName: string
  role: Instructor['role']
  color: string | null
  // ── 기간 흐름 지표 ──
  revenue: number              // 강사 귀속 결제액 (기간)
  newMembers: number           // 그 강사와의 첫 결제가 기간 내인 회원 수
  reregistrationCount: number  // 기간 내 재결제(첫 pass 아님) 건수
  // ── 누적 비율 / 현재 스냅샷 ──
  reregistrationRate: number   // 0~1 (누적)
  trialConversionRate: number  // 0~1 (누적)
  trialMemberCount: number
  convertedMemberCount: number
  activeMembers: number        // 현재 이용중 (스냅샷)
  totalMembers: number         // 누적 담당 회원
  incentive: InstructorIncentiveSummary
}

/** 인센티브 입력 — supabase 타입과 디커플 위해 최소 형태만 받는다. */
export interface IncentiveSetting {
  incentivePerSession: number
}

export function computeInstructorScorecards(
  instructors: Instructor[],
  allPasses: Pass[],
  allByMember: Map<number, Pass[]>,
  period: PeriodRange | null,
  ratesByInstructor: Map<number, IncentiveSetting[]>,
): InstructorScorecardRow[] {
  // 강사별 pass 그룹
  const passesByInstructor = new Map<number, Pass[]>()
  for (const p of allPasses) {
    if (p.instructorId == null) continue
    const arr = passesByInstructor.get(p.instructorId) ?? []
    arr.push(p)
    passesByInstructor.set(p.instructorId, arr)
  }

  const rows: InstructorScorecardRow[] = []
  for (const inst of instructors) {
    const instructorPasses = passesByInstructor.get(inst.id) ?? []

    // 누적 비율·스냅샷은 기존 단일 소스(computeInstructorKPI) 재사용 → 상세 페이지와 정의 일치
    const kpi = computeInstructorKPI(inst.id, instructorPasses, allByMember)

    // 기간 흐름: 이 강사 기준 회원별 pass를 paidAt 오름차순으로 보고
    //  - 회원의 첫 pass(idx 0)가 기간 내면 신규 회원
    //  - 두번째+ pass(idx>=1)가 기간 내면 재등록 건수
    //  - 기간 내 모든 pass 결제액은 매출에 합산
    const byMember = groupPassesByMember(instructorPasses)
    let revenue = 0
    let newMembers = 0
    let reregistrationCount = 0
    for (const [, memberPasses] of byMember) {
      memberPasses.forEach((p, idx) => {
        if (!isInPeriod(p.paidAt ?? p.issuedAt, period)) return
        revenue += p.paymentAmount ?? 0
        if (idx === 0) newMembers++
        else reregistrationCount++
      })
    }

    // 인센티브 요약 (Light) — 회당 인센티브가 설정된 회원만 집계
    const rates = ratesByInstructor.get(inst.id) ?? []
    const withIncentive = rates.filter(r => r.incentivePerSession > 0).map(r => r.incentivePerSession)
    const incentive: InstructorIncentiveSummary = {
      memberCount: withIncentive.length,
      perSessionMin: withIncentive.length ? Math.min(...withIncentive) : null,
      perSessionMax: withIncentive.length ? Math.max(...withIncentive) : null,
      hasAny: withIncentive.length > 0,
    }

    rows.push({
      instructorId: inst.id,
      instructorName: inst.name,
      role: inst.role,
      color: inst.color ?? null,
      revenue,
      newMembers,
      reregistrationCount,
      reregistrationRate: kpi.reregistrationRate,
      trialConversionRate: kpi.trialConversionRate,
      trialMemberCount: kpi.trialMemberCount,
      convertedMemberCount: kpi.convertedMemberCount,
      activeMembers: kpi.activeMemberCount,
      totalMembers: kpi.totalMemberCount,
      incentive,
    })
  }
  return rows
}
