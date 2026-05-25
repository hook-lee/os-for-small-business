import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { setReservationStatus, type ReservationStatus } from '@/lib/supabase/group-reservations'
import { requireOwnerId } from '@/lib/supabase/auth-server'

const VALID_STATUSES: ReservationStatus[] = ['reserved', 'cancelled', 'attended', 'noshow']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let _ownerId: string
  try { _ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  void _ownerId
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    const body = await req.json() as { status?: string }
    if (!body.status || !VALID_STATUSES.includes(body.status as ReservationStatus)) {
      return NextResponse.json({ error: '유효하지 않은 status' }, { status: 400 })
    }
    const result = await setReservationStatus(id, body.status as ReservationStatus)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
