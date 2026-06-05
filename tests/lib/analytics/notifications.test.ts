import { describe, it, expect } from 'vitest'
import { buildNotifications, computePayrollDday, type NotificationInput } from '@/lib/analytics/notifications'
import type { NotificationSettings } from '@/lib/profile/settings'
import type { Member } from '@/lib/supabase/members'
import type { ExpiringMemberInfo, DormantMemberInfo, LowRemainingMemberInfo } from '@/lib/analytics/member-segments'

const ALL_ON: NotificationSettings = {
  lowRemaining: true, expiring: true, dormant: true, unpaidInstructors: true, payrollDday: true,
}
const member = (name: string) => ({ name } as Member)
const low = (name: string, r: number): LowRemainingMemberInfo => ({ member: member(name), remainingCount: r, passName: '개인' })

const baseInput = (): NotificationInput => ({
  lowRemaining: [low('김유진', 2), low('박서연', 1)],
  lowRemainingThreshold: 3,
  expiring: [{} as ExpiringMemberInfo],
  dormant: [{} as DormantMemberInfo, {} as DormantMemberInfo],
  unpaidInstructorCount: 1,
  payrollDday: { active: true, label: 'D-1' },
})

describe('computePayrollDday', () => {
  it('지급일 미설정이면 null', () => {
    expect(computePayrollDday(null, '2026-06-25')).toBeNull()
  })
  it('오늘이 지급일이면 D-day', () => {
    expect(computePayrollDday(25, '2026-06-25')).toEqual({ active: true, label: 'D-day' })
  })
  it('하루 전이면 D-1', () => {
    expect(computePayrollDday(25, '2026-06-24')).toEqual({ active: true, label: 'D-1' })
  })
  it('그 외 날은 null (알림 안 함)', () => {
    expect(computePayrollDday(25, '2026-06-20')).toBeNull()
  })
})

describe('buildNotifications', () => {
  it('모든 설정 ON이면 활성 항목 모두 생성', () => {
    const items = buildNotifications(baseInput(), ALL_ON)
    const types = items.map(i => i.type)
    expect(types).toContain('lowRemaining')
    expect(types).toContain('expiring')
    expect(types).toContain('dormant')
    expect(types).toContain('unpaidInstructors')
    expect(types).toContain('payrollDday')
    expect(items.find(i => i.type === 'lowRemaining')!.title).toContain('3회 이하 2명')
  })

  it('설정 OFF면 해당 알림 제외', () => {
    const items = buildNotifications(baseInput(), { ...ALL_ON, lowRemaining: false, payrollDday: false })
    const types = items.map(i => i.type)
    expect(types).not.toContain('lowRemaining')
    expect(types).not.toContain('payrollDday')
    expect(types).toContain('expiring')
  })

  it('데이터 없으면(빈 세그먼트) 항목 안 만듦', () => {
    const empty: NotificationInput = {
      lowRemaining: [], lowRemainingThreshold: 3, expiring: [], dormant: [],
      unpaidInstructorCount: 0, payrollDday: null,
    }
    expect(buildNotifications(empty, ALL_ON)).toHaveLength(0)
  })
})
