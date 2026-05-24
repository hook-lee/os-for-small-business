import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { createReservation } from '@/lib/supabase/group-reservations'

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  try {
    const body = await req.json() as { sessionId?: number; memberId?: number; passId?: number | null }
    if (!body.sessionId || !body.memberId) {
      return NextResponse.json({ error: 'sessionId, memberId 필수' }, { status: 400 })
    }
    const id = await createReservation({
      sessionId: body.sessionId,
      memberId: body.memberId,
      passId: body.passId ?? null,
    })
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
