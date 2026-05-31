import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import {
  fetchUpcomingGroupSessions,
  createGroupSession,
  type CreateGroupSessionInput,
} from '@/lib/supabase/group-sessions'
import { findRoomTimeConflict } from '@/lib/supabase/rooms'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const sessions = await fetchUpcomingGroupSessions(ownerId)
    return NextResponse.json({ sessions })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as Partial<CreateGroupSessionInput>
    if (!body.sessionName || !body.lessonDate || !body.lessonTime) {
      return NextResponse.json({ error: 'sessionName, lessonDate, lessonTime 필수' }, { status: 400 })
    }
    // 룸·시간 cross-table 충돌 검증
    if (body.roomId) {
      const conflict = await findRoomTimeConflict(
        ownerId,
        body.roomId,
        body.lessonDate,
        body.lessonTime,
      )
      if (conflict) {
        return NextResponse.json({
          error: `해당 룸·시간에 이미 ${conflict.description}이 있습니다`,
          conflict,
        }, { status: 409 })
      }
    }
    const id = await createGroupSession({
      sessionName: body.sessionName,
      lessonDate: body.lessonDate,
      lessonTime: body.lessonTime,
      instructorId: body.instructorId ?? null,
      roomId: body.roomId ?? null,
      durationMinutes: body.durationMinutes,
      capacity: body.capacity,
      notes: body.notes,
    }, ownerId)
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
