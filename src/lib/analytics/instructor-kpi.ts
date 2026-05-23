import type { Pass } from '@/lib/supabase/passes'

export interface InstructorKPI {
  instructorId: number
  totalRevenue: number              // 강사 담당 수강권 매출 합계
  activeMemberCount: number         // 현재 '이용중' 수강권 보유 회원 수 (unique)
  totalMemberCount: number          // 이 강사 거쳐간 전체 회원 수 (unique)
  reregistrationRate: number        // 0~1, 같은 강사한테 2회+ 결제한 회원 비율
  trialConversionRate: number       // 0~1, 체험 후 정회원으로 전환한 비율 (이 강사 담당 회원 중 첫 pass가 체험인 사람들의 전환율)
  trialMemberCount: number          // 체험 회원 수
  convertedMemberCount: number      // 전환된 회원 수
}

function isTrialPassName(name: string): boolean {
  return name.includes('체험')
}

/**
 * 강사의 KPI 계산.
 * @param passes 이 강사의 instructor_id로 필터된 passes (전체)
 * @param allPassesByMember 전 회원의 모든 pass — 회원의 첫 pass 확인용 (회원 id → passes 배열, paid_at 오름차순)
 */
export function computeInstructorKPI(
  instructorId: number,
  passes: Pass[],
  allPassesByMember: Map<number, Pass[]>,
): InstructorKPI {
  // 매출 합계
  const totalRevenue = passes.reduce((sum, p) => sum + (p.paymentAmount ?? 0), 0)

  // 회원 그룹화
  const memberPassMap = new Map<number, Pass[]>()
  for (const p of passes) {
    const arr = memberPassMap.get(p.memberId) ?? []
    arr.push(p)
    memberPassMap.set(p.memberId, arr)
  }

  const totalMemberCount = memberPassMap.size

  // 활성 회원 수 (이용중 pass 보유)
  let activeMemberCount = 0
  for (const [, memberPasses] of memberPassMap) {
    if (memberPasses.some(p => p.status === '이용중')) activeMemberCount++
  }

  // 재등록률: 이 강사 밑에서 2회+ 결제한 회원 비율
  let multiPassCount = 0
  for (const [, memberPasses] of memberPassMap) {
    if (memberPasses.length >= 2) multiPassCount++
  }
  const reregistrationRate = totalMemberCount === 0 ? 0 : multiPassCount / totalMemberCount

  // 전환율: 이 강사 담당 회원 중 첫 pass가 체험이었고, 그 후 정회원(non-체험) pass가 있는 비율
  let trialMemberCount = 0
  let convertedMemberCount = 0
  for (const [memberId] of memberPassMap) {
    const memberAll = allPassesByMember.get(memberId) ?? []
    if (memberAll.length === 0) continue
    // paid_at 오름차순 가정
    const firstPass = memberAll[0]
    if (!isTrialPassName(firstPass.passName)) continue
    trialMemberCount++
    // 같은 회원에 non-체험 pass가 있는가 (모든 강사 포함)
    if (memberAll.some(p => !isTrialPassName(p.passName))) {
      convertedMemberCount++
    }
  }
  const trialConversionRate = trialMemberCount === 0 ? 0 : convertedMemberCount / trialMemberCount

  return {
    instructorId,
    totalRevenue,
    activeMemberCount,
    totalMemberCount,
    reregistrationRate,
    trialConversionRate,
    trialMemberCount,
    convertedMemberCount,
  }
}

/**
 * 전체 전환율 (강사 무관, 전체 회원 기준)
 */
export function computeOverallTrialConversion(allPassesByMember: Map<number, Pass[]>): {
  trialCount: number
  convertedCount: number
  rate: number
} {
  let trialCount = 0
  let convertedCount = 0
  for (const [, passes] of allPassesByMember) {
    if (passes.length === 0) continue
    const first = passes[0]
    if (!isTrialPassName(first.passName)) continue
    trialCount++
    if (passes.some(p => !isTrialPassName(p.passName))) convertedCount++
  }
  return {
    trialCount,
    convertedCount,
    rate: trialCount === 0 ? 0 : convertedCount / trialCount,
  }
}

/**
 * passes 배열을 memberId별 정렬된 Map으로 그룹.
 * paid_at 오름차순. paid_at null이면 issued_at 차순. 둘 다 null이면 0.
 */
export function groupPassesByMember(passes: Pass[]): Map<number, Pass[]> {
  const map = new Map<number, Pass[]>()
  for (const p of passes) {
    const arr = map.get(p.memberId) ?? []
    arr.push(p)
    map.set(p.memberId, arr)
  }
  for (const [, arr] of map) {
    arr.sort((a, b) => {
      const aDate = a.paidAt ?? a.issuedAt ?? ''
      const bDate = b.paidAt ?? b.issuedAt ?? ''
      return aDate.localeCompare(bDate)
    })
  }
  return map
}
