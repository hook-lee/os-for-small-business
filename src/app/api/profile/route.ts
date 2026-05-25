import { NextResponse } from 'next/server'
import { loadProfile, saveProfile, type UserProfile } from '@/lib/profile/settings'
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
    await saveProfile(merged, auth.ownerId)
    return NextResponse.json(merged)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
