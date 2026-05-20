import { NextResponse } from 'next/server'
import { loadProfile, saveProfile, DEFAULT_PROFILE, type UserProfile } from '@/lib/profile/settings'

export async function GET() {
  const profile = await loadProfile()
  return NextResponse.json(profile)
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Partial<UserProfile>
    const current = await loadProfile()
    const merged: UserProfile = { ...current, ...body } as UserProfile
    // validation
    if (![0, 0.5, 1.0].includes(merged.youngStartupReductionRate as number)) {
      return NextResponse.json({ error: 'invalid youngStartupReductionRate' }, { status: 400 })
    }
    if (typeof merged.noranusanAnnualContribution !== 'number' || merged.noranusanAnnualContribution < 0) {
      return NextResponse.json({ error: 'invalid noranusan amount' }, { status: 400 })
    }
    await saveProfile(merged)
    return NextResponse.json(merged)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
