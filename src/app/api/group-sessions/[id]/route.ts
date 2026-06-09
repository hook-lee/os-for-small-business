import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { fetchSessionById, deleteGroupSession, updateGroupSession, cancelGroupSession } from '@/lib/supabase/group-sessions'
import { fetchReservationsBySession } from '@/lib/supabase/group-reservations'
import { findRoomTimeConflict } from '@/lib/supabase/rooms'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    const session = await fetchSessionById(id, ownerId)
    if (!session) return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    const reservations = await fetchReservationsBySession(id)
    return NextResponse.json({ session, reservations })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    const body = await req.json() as {
      roomId?: number | null
      lessonTime?: string | null
      instructorId?: number | null
      capacity?: number
      notes?: string | null
      lessonDate?: string
      cancel?: boolean
      cancelReason?: string
    }
    // 취소(soft) — 사유 기록. '인원 부족'이면 폐강으로 집계.
    if (body.cancel) {
      const reason = (body.cancelReason ?? '기타').trim() || '기타'
      await cancelGroupSession(id, reason, ownerId)
      return NextResponse.json({ ok: true })
    }
    // 룸·시간 cross-table 충돌 검증
    if (body.roomId && body.lessonTime && body.lessonDate) {
      const conflict = await findRoomTimeConflict(
        ownerId,
        body.roomId,
        body.lessonDate,
        body.lessonTime,
        { groupSessionId: id },
      )
      if (conflict) {
        return NextResponse.json({
          error: `해당 룸·시간에 이미 ${conflict.description}이 있습니다`,
          conflict,
        }, { status: 409 })
      }
    }
    await updateGroupSession(id, {
      roomId: body.roomId,
      lessonTime: body.lessonTime,
      instructorId: body.instructorId,
      capacity: body.capacity,
      notes: body.notes,
      lessonDate: body.lessonDate,   // 드래그 이동 시 날짜 변경 (예약자 FK로 따라옴)
    }, ownerId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    await deleteGroupSession(id, ownerId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
