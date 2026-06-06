import { NextResponse } from 'next/server'
import { loadProfile, saveProfile, sanitizeAnnualGoals, sanitizeNotificationSettings, type UserProfile } from '@/lib/profile/settings'
import { ensureDefaultRoom } from '@/lib/supabase/rooms'
import { requireOwnerId } from '@/lib/supabase/auth-server'

async function authGuard(): Promise<{ ownerId: string } | NextResponse> {
  try {
    const ownerId = await requireOwnerId()
    return { ownerId }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function GET() {
  const auth = await authGuard()
  if (auth instanceof NextResponse) return auth
  const profile = await loadProfile(auth.ownerId)
  return NextResponse.json(profile)
}

export async function POST(req: Request) {
  const auth = await authGuard()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json() as Partial<UserProfile>
    const current = await loadProfile(auth.ownerId)
    const merged: UserProfile = { ...current, ...body } as UserProfile
    // validation
    if (![0, 0.5, 1.0].includes(merged.youngStartupReductionRate as number)) {
      return NextResponse.json({ error: 'invalid youngStartupReductionRate' }, { status: 400 })
    }
    if (typeof merged.noranusanAnnualContribution !== 'number' || merged.noranusanAnnualContribution < 0) {
      return NextResponse.json({ error: 'invalid noranusan amount' }, { status: 400 })
    }
    if (!['general', 'simplified'].includes(merged.taxPayerType)) {
      merged.taxPayerType = 'general'
    }
    // 인적공제 인원: 최소 1 (본인), 정수
    merged.personalDeductionCount = Math.max(1, Math.floor(Number(merged.personalDeductionCount) || 1))
    // 잔여횟수 알림 기준: 0~99 정수 (0 = 끔)
    merged.lowRemainingThreshold = Math.min(99, Math.max(0, Math.floor(Number(merged.lowRemainingThreshold) || 0)))
    // 알림 설정 ON/OFF + 강사 월급 지급일(1~30 또는 31=말일, null=미설정)
    merged.notificationSettings = sanitizeNotificationSettings(merged.notificationSettings)
    merged.payrollDay = merged.payrollDay == null ? null : Math.min(31, Math.max(1, Math.floor(Number(merged.payrollDay)) || 1))
    // 연간 목표: sanitize (잘못된 값 null, 비율 0~1 정규화)
    merged.annualGoals = sanitizeAnnualGoals(merged.annualGoals)
    await saveProfile(merged, auth.ownerId)
    // 신규 가입 직후 첫 profile 저장이면 기본 룸 1개 시드 (멱등 — 이미 있으면 noop)
    try { await ensureDefaultRoom(auth.ownerId) } catch { /* 실패해도 profile은 저장됨 */ }
    return NextResponse.json(merged)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
