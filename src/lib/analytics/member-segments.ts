import type { Member } from '@/lib/supabase/members'
import type { Pass } from '@/lib/supabase/passes'
import { isInactivePassStatus } from './member-status'

export interface ExpiringMemberInfo {
  member: Member
  daysUntilExpiry: number
  passName: string
  endDate: string
  remainingCount: number | null
}

/**
 * 만료 임박: passes 중 status='이용중' AND end_date <= today+window
 */
export function findExpiringMembers(
  members: Member[],
  passes: Pass[],
  today: string,
  windowDays: number = 7,
): ExpiringMemberInfo[] {
  const memberMap = new Map(members.map(m => [m.id, m]))
  const todayDate = new Date(today)
  const cutoff = new Date(todayDate)
  cutoff.setDate(cutoff.getDate() + windowDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const result: ExpiringMemberInfo[] = []
  for (const p of passes) {
    // status 정확 문자열('이용중')에 의존하지 않음 — 임포트 데이터는 표기가 제각각.
    // 명시적 종료(환불·정지·만료 등)만 제외하고, 잔여>0 + 기간 임박으로 판정.
    if (isInactivePassStatus(p.status)) continue
    if ((p.remainingCount ?? 0) <= 0) continue
    if (!p.endDate) continue
    if (p.endDate > cutoffStr) continue
    if (p.endDate < today) continue  // 이미 만료된 건 제외 (별도 휴면으로 잡힘)
    const member = memberMap.get(p.memberId)
    if (!member) continue
    const expiry = new Date(p.endDate)
    const days = Math.floor((expiry.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
    result.push({
      member,
      daysUntilExpiry: days,
      passName: p.passName,
      endDate: p.endDate,
      remainingCount: p.remainingCount,
    })
  }
  return result.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
}

export interface DormantMemberInfo {
  member: Member
  lastAttendedAt: string | null
  daysSinceAttended: number  // null이면 9999
}

/**
 * 휴면: last_attended_at < today-thresholdDays OR null
 * 단, 등록은 한 적 있어야 (registeredAt 있어야)
 */
export function findDormantMembers(
  members: Member[],
  today: string,
  thresholdDays: number = 60,
): DormantMemberInfo[] {
  const todayDate = new Date(today)
  const result: DormantMemberInfo[] = []
  for (const m of members) {
    if (!m.registeredAt) continue
    if (!m.lastAttendedAt) {
      // 출석 기록 없음 + 등록한 지 thresholdDays 이상 지났으면 휴면
      const regDate = new Date(m.registeredAt)
      const days = Math.floor((todayDate.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24))
      if (days >= thresholdDays) {
        result.push({ member: m, lastAttendedAt: null, daysSinceAttended: days })
      }
      continue
    }
    const lastDate = new Date(m.lastAttendedAt)
    const days = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    if (days >= thresholdDays) {
      result.push({ member: m, lastAttendedAt: m.lastAttendedAt, daysSinceAttended: days })
    }
  }
  return result.sort((a, b) => b.daysSinceAttended - a.daysSinceAttended)
}
