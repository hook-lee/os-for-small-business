import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import {
  fetchRatesByMember,
  upsertMemberInstructorRate,
  deleteMemberInstructorRate,
} from '@/lib/supabase/member-instructor-rates'

export async function GET(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ rates: [] })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const url = new URL(req.url)
  const memberIdRaw = url.searchParams.get('memberId')
  const memberId = memberIdRaw ? parseInt(memberIdRaw, 10) : NaN
  if (!Number.isFinite(memberId) || memberId <= 0) {
    return NextResponse.json({ error: 'memberId 필수' }, { status: 400 })
  }
  try {
    const rates = await fetchRatesByMember(memberId, ownerId)
    return NextResponse.json({ rates })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as {
      memberId?: number
      instructorId?: number
      customRate?: number | null
      incentivePerSession?: number
      memo?: string | null
    }
    if (!body.memberId || !body.instructorId) {
      return NextResponse.json({ error: 'memberId, instructorId 필수' }, { status: 400 })
    }
    // 검증: 음수 금지
    const customRate = body.customRate == null ? null : Math.trunc(body.customRate)
    if (customRate != null && (!Number.isFinite(customRate) || customRate < 0)) {
      return NextResponse.json({ error: '시급은 0 이상의 정수' }, { status: 400 })
    }
    const incentive = Math.trunc(body.incentivePerSession ?? 0)
    if (!Number.isFinite(incentive) || incentive < 0) {
      return NextResponse.json({ error: '인센티브는 0 이상의 정수' }, { status: 400 })
    }
    await upsertMemberInstructorRate({
      memberId: body.memberId,
      instructorId: body.instructorId,
      customRate,
      incentivePerSession: incentive,
      memo: body.memo ?? null,
    }, ownerId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const url = new URL(req.url)
  const memberId = parseInt(url.searchParams.get('memberId') ?? '', 10)
  const instructorId = parseInt(url.searchParams.get('instructorId') ?? '', 10)
  if (!Number.isFinite(memberId) || !Number.isFinite(instructorId)) {
    return NextResponse.json({ error: 'memberId, instructorId 필수' }, { status: 400 })
  }
  try {
    await deleteMemberInstructorRate(memberId, instructorId, ownerId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
