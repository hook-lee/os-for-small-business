import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { fetchLessonsByDate, fetchLessonsByMonth, createLesson, type CreateLessonInput } from '@/lib/supabase/lessons'
import { findRoomTimeConflict } from '@/lib/supabase/rooms'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ lessons: [] })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const url = new URL(req.url)
  const month = url.searchParams.get('month')
  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month (YYYY-MM) 필수' }, { status: 400 })
    }
    try {
      const lessons = await fetchLessonsByMonth(month, ownerId)
      return NextResponse.json({ lessons })
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 500 })
    }
  }
  const date = url.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) 또는 month (YYYY-MM) 필수' }, { status: 400 })
  }
  try {
    const lessons = await fetchLessonsByDate(date, ownerId)
    return NextResponse.json({ lessons })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as Partial<CreateLessonInput>
    if (!body.memberId || !body.lessonDate) {
      return NextResponse.json({ error: 'memberId, lessonDate 필수' }, { status: 400 })
    }
    // 룸·시간 cross-table 충돌 검증 (같은 룸+시간에 group_sessions 있으면 차단)
    if (body.roomId && body.lessonTime) {
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
    const id = await createLesson({
      memberId: body.memberId,
      lessonDate: body.lessonDate,
      passId: body.passId ?? null,
      instructorId: body.instructorId ?? null,
      roomId: body.roomId ?? null,
      lessonTime: body.lessonTime,
      durationMinutes: body.durationMinutes,
      memo: body.memo,
    }, ownerId)
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
