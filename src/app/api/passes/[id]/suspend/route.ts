import { NextResponse } from 'next/server'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { createSuspension, deleteSuspension } from '@/lib/supabase/pass-suspensions'
import { loadProfile } from '@/lib/profile/settings'

async function guard(): Promise<{ ownerId: string } | NextResponse> {
  try { return { ownerId: await requireOwnerId() } }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await guard()
  if (auth instanceof NextResponse) return auth
  const { id: idRaw } = await ctx.params
  const passId = Number(idRaw)
  if (!Number.isFinite(passId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  try {
    const body = await req.json() as { startDate?: string; endDate?: string; reason?: string }
    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: '정지 시작일·종료일 필수' }, { status: 400 })
    }
    const profile = await loadProfile(auth.ownerId).catch(() => null)
    const maxDays = profile?.maxSuspendDays ?? 30
    const result = await createSuspension(
      { passId, startDate: body.startDate, endDate: body.endDate, reason: body.reason },
      auth.ownerId,
      maxDays,
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(req: Request, _ctx: { params: Promise<{ id: string }> }) {
  const auth = await guard()
  if (auth instanceof NextResponse) return auth
  const suspensionId = Number(new URL(req.url).searchParams.get('suspensionId'))
  if (!Number.isFinite(suspensionId)) return NextResponse.json({ error: 'suspensionId 필수' }, { status: 400 })
  try {
    await deleteSuspension(suspensionId, auth.ownerId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
