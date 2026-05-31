import { NextResponse } from 'next/server'
import { fetchAllRooms, createRoom } from '@/lib/supabase/rooms'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ rooms: [] })
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const rooms = await fetchAllRooms(ownerId)
    return NextResponse.json({ rooms })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as { name?: string; displayOrder?: number }
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: '룸 이름 필수' }, { status: 400 })
    }
    const id = await createRoom({
      name: body.name.trim(),
      displayOrder: body.displayOrder ?? 0,
    }, ownerId)
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
