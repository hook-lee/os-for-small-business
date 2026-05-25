import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { createReservation } from '@/lib/supabase/group-reservations'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let _ownerId: string
  // group_reservations 자체는 owner_id 컬럼 없음. 단 운영자 작업 가드를 위해 auth는 요구.
  try { _ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  void _ownerId
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
