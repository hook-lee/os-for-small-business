import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { fetchAllMembers } from '@/lib/supabase/members'
import { fetchAllPasses } from '@/lib/supabase/passes'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { fetchPayrollByMonth, type PayrollRecord } from '@/lib/supabase/payroll'
import { loadProfile } from '@/lib/profile/settings'
import { findLowRemainingMembers, findExpiringMembers, findDormantMembers } from '@/lib/analytics/member-segments'
import { buildNotifications, computePayrollDday } from '@/lib/analytics/notifications'

/**
 * 종(알림) 패널용 — 원장 알림 목록. 설정(ON/OFF)에 따라 필터된 활성 알림만.
 * 데이터가 무거우니(전 회원·수강권) 종을 열 때 1회 fetch.
 */
export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ items: [] })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ items: [] }) }
  try {
    const today = new Date().toISOString().slice(0, 10)
    const yearMonth = today.slice(0, 7)
    const [members, passes, instructors, payroll, profile] = await Promise.all([
      fetchAllMembers(ownerId),
      fetchAllPasses(ownerId),
      fetchAllInstructors(ownerId),
      fetchPayrollByMonth(yearMonth, ownerId).catch(() => [] as PayrollRecord[]),
      loadProfile(ownerId),
    ])

    const lowRemaining = findLowRemainingMembers(members, passes, today, profile.lowRemainingThreshold)
    const expiring = findExpiringMembers(members, passes, today, 7)
    const dormant = findDormantMembers(members, today, 60)
    const paidIds = new Set(payroll.filter(r => r.paid).map(r => r.instructorId))
    const unpaidInstructorCount = instructors.filter(i => i.role !== 'owner' && !paidIds.has(i.id)).length

    const items = buildNotifications({
      lowRemaining,
      lowRemainingThreshold: profile.lowRemainingThreshold,
      expiring,
      dormant,
      unpaidInstructorCount,
      payrollDday: computePayrollDday(profile.payrollDay, today),
    }, profile.notificationSettings)

    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ items: [] })
  }
}
