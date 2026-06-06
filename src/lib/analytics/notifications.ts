import type { NotificationSettings } from '@/lib/profile/settings'
import type { LowRemainingMemberInfo, ExpiringMemberInfo, DormantMemberInfo } from './member-segments'

export type NotificationType = 'lowRemaining' | 'expiring' | 'dormant' | 'unpaidInstructors' | 'payrollDday'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  detail: string
  href: string
  severity: 'info' | 'warn' | 'urgent'
}

/**
 * 강사 월급 지급일 D-day 계산. payrollDay = 매월 며칠(1~30) 또는 31=말일.
 *  - 31(말일)이면 그 달 실제 말일(28/29/30/31)로 환산.
 *  - 1~30이라도 그 달에 없는 날(예: 2월 30일)이면 말일로 클램프.
 * 오늘이 지급일이면 D-day, 하루 전이면 D-1일 때만 active.
 */
export function computePayrollDday(payrollDay: number | null | undefined, today: string): { active: boolean; label: string } | null {
  if (!payrollDay) return null
  const [y, m, d] = today.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()   // 그 달 말일
  const target = Math.min(payrollDay, lastDay)   // 31(말일)·없는 날 → 말일로 클램프
  const diff = target - d
  if (diff === 0) return { active: true, label: 'D-day' }
  if (diff === 1) return { active: true, label: 'D-1' }
  return null
}

export interface NotificationInput {
  lowRemaining: LowRemainingMemberInfo[]
  lowRemainingThreshold: number
  expiring: ExpiringMemberInfo[]
  dormant: DormantMemberInfo[]
  unpaidInstructorCount: number
  payrollDday: { active: boolean; label: string } | null
}

/**
 * 설정(ON/OFF)에 따라 활성 알림 목록 생성. 종(bell) 패널·홈에 공통.
 */
export function buildNotifications(input: NotificationInput, settings: NotificationSettings): NotificationItem[] {
  const items: NotificationItem[] = []

  if (settings.lowRemaining && input.lowRemaining.length > 0) {
    items.push({
      id: 'lowRemaining',
      type: 'lowRemaining',
      title: `잔여 ${input.lowRemainingThreshold}회 이하 ${input.lowRemaining.length}명`,
      detail: input.lowRemaining.slice(0, 3).map(x => `${x.member.name}(${x.remainingCount}회)`).join(', ') || '재등록 안내 필요',
      href: '/members?filter=low',
      severity: 'warn',
    })
  }
  if (settings.expiring && input.expiring.length > 0) {
    items.push({
      id: 'expiring',
      type: 'expiring',
      title: `만료 임박 ${input.expiring.length}명`,
      detail: '7일 내 수강권 만료 — 재등록 안내',
      href: '/members?filter=expiring',
      severity: 'warn',
    })
  }
  if (settings.dormant && input.dormant.length > 0) {
    items.push({
      id: 'dormant',
      type: 'dormant',
      title: `휴면 회원 ${input.dormant.length}명`,
      detail: '60일+ 미출석 — 안부 연락',
      href: '/members?filter=dormant',
      severity: 'info',
    })
  }
  if (settings.unpaidInstructors && input.unpaidInstructorCount > 0) {
    items.push({
      id: 'unpaidInstructors',
      type: 'unpaidInstructors',
      title: `미정산 강사 ${input.unpaidInstructorCount}명`,
      detail: '이번달 급여 미지급',
      href: '/instructors?tab=payroll',
      severity: 'info',
    })
  }
  if (settings.payrollDday && input.payrollDday?.active) {
    items.push({
      id: 'payrollDday',
      type: 'payrollDday',
      title: `강사 월급 ${input.payrollDday.label}`,
      detail: '급여 지급 예정 — 정산 확인',
      href: '/instructors?tab=payroll',
      severity: 'urgent',
    })
  }

  return items
}
