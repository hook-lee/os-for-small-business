import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { setLessonStatus, deleteLesson, updateLesson, type LessonStatus } from '@/lib/supabase/lessons'
import { findRoomTimeConflict } from '@/lib/supabase/rooms'
import { requireOwnerId } from '@/lib/supabase/auth-server'

const VALID_STATUSES: LessonStatus[] = ['scheduled', 'completed', 'cancelled_same_day', 'cancelled_advance', 'noshow']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    const body = await req.json() as {
      status?: string
      roomId?: number | null
      lessonTime?: string | null
      instructorId?: number | null
      memo?: string | null
      lessonDate?: string  // 충돌 검사용 (선택)
    }

    // 분기 1: status 변경 (기존 동작)
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status as LessonStatus)) {
        return NextResponse.json({ error: '유효하지 않은 status' }, { status: 400 })
      }
      const result = await setLessonStatus(id, body.status as LessonStatus, ownerId)
      return NextResponse.json({ ok: true, ...result })
    }

    // 분기 2: 룸/시간/강사/메모 등 수정
    // 룸·시간 변경시 cross-table 충돌 검증 (자기 자신 제외)
    if (body.roomId && body.lessonTime && body.lessonDate) {
      const conflict = await findRoomTimeConflict(
        ownerId,
        body.roomId,
        body.lessonDate,
        body.lessonTime,
        { lessonId: id },
      )
      if (conflict) {
        return NextResponse.json({
          error: `해당 룸·시간에 이미 ${conflict.description}이 있습니다`,
          conflict,
        }, { status: 409 })
      }
    }

    await updateLesson(id, {
      roomId: body.roomId,
      lessonTime: body.lessonTime,
      instructorId: body.instructorId,
      memo: body.memo,
      lessonDate: body.lessonDate,   // 드래그 이동 시 날짜 변경
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
    const result = await deleteLesson(id, ownerId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
