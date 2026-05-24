import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { adjustPassCount } from '@/lib/supabase/passes'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  const { id: idRaw } = await params
  const passId = parseInt(idRaw, 10)
  if (!Number.isFinite(passId) || passId <= 0) {
    return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  }
  try {
    const body = await req.json() as { delta?: number; reason?: string }
    const delta = Number(body.delta)
    const reason = (body.reason ?? '').toString()
    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json({ error: 'delta는 0 아닌 정수' }, { status: 400 })
    }
    if (!reason.trim()) {
      return NextResponse.json({ error: '사유는 필수' }, { status: 400 })
    }
    await adjustPassCount(passId, Math.trunc(delta), reason)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
