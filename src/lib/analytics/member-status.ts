/**
 * 회원 상태 자동 분류 (수강권 기반).
 *
 *  - active    : '이용중' 수강권 + remaining_count > 0 + 종료일 미도래
 *  - expired   : 수강권 있긴 하지만 다 만료
 *  - no_pass   : 수강권 한 번도 없는 상태 (또는 모두 cancel)
 *
 * 우리 모델엔 '정지'·'미결제'를 따로 표현하는 컬럼이 없으니 위 3분류로 갈음.
 * 향후 members.status 컬럼 추가하면 그때 확장.
 */

export type MemberStatus = 'active' | 'expired' | 'no_pass'

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  active: '이용회원',
  expired: '만료회원',
  no_pass: '수강권 없음',
}

export const MEMBER_STATUS_COLOR: Record<MemberStatus, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-amber-100 text-amber-700',
  no_pass: 'bg-neutral-100 text-neutral-500',
}

export interface PassLike {
  memberId: number
  status: string | null
  remainingCount: number | null
  endDate: string | null
  startDate: string | null
  passType: string | null   // '프라이빗' / '그룹'
  passName: string
}

/**
 * 명백히 '사용 불가'로 못박힌 수강권 상태 키워드.
 * 기간·잔여가 멀쩡해도 이 상태면 active 아님 (환불/정지/양도/해지/만료/종료 등).
 */
const INACTIVE_STATUS_KEYWORDS = ['만료', '환불', '정지', '양도', '취소', '해지', '종료']

export function isInactivePassStatus(status: string | null | undefined): boolean {
  if (!status) return false
  return INACTIVE_STATUS_KEYWORDS.some(k => status.includes(k))
}

/**
 * 회원에 대한 active 패스(현재 사용 가능) 추출.
 *
 * 판정 기준 = 잔여 횟수 > 0  &&  이용기간(종료일) 미도래  &&  상태가 명시적 종료/무효가 아님.
 *
 * status === '이용중' 같은 '정확한 문자열'에는 의존하지 않는다 —
 * 과거 임포트 데이터는 status 표기가 제각각(빈값/'유효'/'활성' 등)이라
 * 기간·잔여가 멀쩡한데도 만료로 잘못 잡히던 버그가 있었음. 이제 출처(앱/임포트/시드)
 * 무관하게 '잔여+기간'을 중심으로 판정하고, 환불·정지 등 명시적 종료 상태만 배제한다.
 */
export function findActivePasses(passes: PassLike[], today: string): PassLike[] {
  return passes.filter(p =>
    !isInactivePassStatus(p.status) &&
    (p.remainingCount ?? 0) > 0 &&
    (p.endDate === null || p.endDate >= today),
  )
}

/**
 * 회원 상태 분류 (single member).
 */
export function computeMemberStatus(memberPasses: PassLike[], today: string): MemberStatus {
  if (memberPasses.length === 0) return 'no_pass'
  if (findActivePasses(memberPasses, today).length > 0) return 'active'
  return 'expired'
}

/**
 * 수업 추가 가드: 이 회원에게 지금 수업을 잡아도 되는가?
 *  - usable=true  : 사용 가능한 수강권 있음 (정상)
 *  - usable=false : 잔여 0회 / 기간 만료 / 수강권 없음 → 무료 수업 위험 경고용
 * UI에서 경고 배너 + 저장 시 한 번 더 확인하는 데 쓴다.
 */
export interface PassGuard {
  usable: boolean
  status: MemberStatus
  reason: string
}

export function evaluatePassGuard(passes: PassLike[], today: string): PassGuard {
  const status = computeMemberStatus(passes, today)
  if (status === 'active') return { usable: true, status, reason: '' }
  const reason = status === 'no_pass'
    ? '등록된 수강권이 없습니다'
    : '이용 가능한 수강권이 없습니다 (잔여 0회 또는 기간 만료)'
  return { usable: false, status, reason }
}

/**
 * 회원 ID → 상태 매핑 (한 번에 계산).
 */
export function buildMemberStatusMap(
  memberIds: number[],
  passes: PassLike[],
  today: string,
): Map<number, MemberStatus> {
  // 회원별 패스 그룹화
  const byMember = new Map<number, PassLike[]>()
  for (const p of passes) {
    if (!byMember.has(p.memberId)) byMember.set(p.memberId, [])
    byMember.get(p.memberId)!.push(p)
  }
  const map = new Map<number, MemberStatus>()
  for (const id of memberIds) {
    map.set(id, computeMemberStatus(byMember.get(id) ?? [], today))
  }
  return map
}

/**
 * 회원의 잔여 회차 / 잔여 일수 (가장 active한 패스 기준).
 * 통계·필터링 용.
 */
export interface MemberMetrics {
  passType: '프라이빗' | '그룹' | null   // 가장 active 패스의 종류
  remainingCount: number | null
  daysToExpire: number | null          // null = 만료 없음 또는 패스 없음
}

export function buildMemberMetricsMap(
  memberIds: number[],
  passes: PassLike[],
  today: string,
): Map<number, MemberMetrics> {
  const byMember = new Map<number, PassLike[]>()
  for (const p of passes) {
    if (!byMember.has(p.memberId)) byMember.set(p.memberId, [])
    byMember.get(p.memberId)!.push(p)
  }

  const map = new Map<number, MemberMetrics>()
  for (const id of memberIds) {
    const ps = byMember.get(id) ?? []
    const active = findActivePasses(ps, today)
    if (active.length === 0) {
      map.set(id, { passType: null, remainingCount: null, daysToExpire: null })
      continue
    }
    // 가장 적게 남은 패스가 운영자 관점에서 중요 (만료 임박 알림 등)
    const sorted = [...active].sort((a, b) => {
      const ea = a.endDate ?? '9999-12-31'
      const eb = b.endDate ?? '9999-12-31'
      return ea.localeCompare(eb)
    })
    const p = sorted[0]
    const days = p.endDate ? Math.ceil((new Date(p.endDate).getTime() - new Date(today).getTime()) / 86_400_000) : null
    map.set(id, {
      passType: p.passType === '그룹' ? '그룹' : p.passType === '프라이빗' ? '프라이빗' : null,
      remainingCount: p.remainingCount,
      daysToExpire: days,
    })
  }
  return map
}
