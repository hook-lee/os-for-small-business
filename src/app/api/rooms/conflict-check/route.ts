import { NextResponse } from 'next/server'
import { findRoomTimeConflict } from '@/lib/supabase/rooms'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'

/**
 * GET /api/rooms/conflict-check?roomId=N&date=YYYY-MM-DD&time=HH:MM
 *   [&excludeLessonId=N | &excludeGroupSessionId=N]
 *
 * 같은 룸·날짜·시간에 lessons/group_sessions 어느 쪽이든 존재하면 { conflict } 반환.
 */
export async function GET(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ conflict: null })
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const url = new URL(req.url)
  const roomIdStr = url.searchParams.get('roomId')
  const date = url.searchParams.get('date')
  const time = url.searchParams.get('time')
  if (!roomIdStr || !date || !time) {
    return NextResponse.json({ error: 'roomId, date, time 필수' }, { status: 400 })
  }
  const roomId = parseInt(roomIdStr, 10)
  if (!Number.isFinite(roomId) || roomId <= 0) {
    return NextResponse.json({ error: '유효하지 않은 roomId' }, { status: 400 })
  }

  const exclude: { lessonId?: number; groupSessionId?: number } = {}
  const excludeLessonId = url.searchParams.get('excludeLessonId')
  const excludeGroupSessionId = url.searchParams.get('excludeGroupSessionId')
  if (excludeLessonId) exclude.lessonId = parseInt(excludeLessonId, 10)
  if (excludeGroupSessionId) exclude.groupSessionId = parseInt(excludeGroupSessionId, 10)

  try {
    const conflict = await findRoomTimeConflict(ownerId, roomId, date, time, exclude)
    return NextResponse.json({ conflict })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
