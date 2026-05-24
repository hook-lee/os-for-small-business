import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import {
  fetchUpcomingGroupSessions,
  createGroupSession,
  type CreateGroupSessionInput,
} from '@/lib/supabase/group-sessions'

export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  try {
    const sessions = await fetchUpcomingGroupSessions()
    return NextResponse.json({ sessions })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  try {
    const body = await req.json() as Partial<CreateGroupSessionInput>
    if (!body.sessionName || !body.lessonDate || !body.lessonTime) {
      return NextResponse.json({ error: 'sessionName, lessonDate, lessonTime 필수' }, { status: 400 })
    }
    const id = await createGroupSession({
      sessionName: body.sessionName,
      lessonDate: body.lessonDate,
      lessonTime: body.lessonTime,
      instructorId: body.instructorId ?? null,
      durationMinutes: body.durationMinutes,
      capacity: body.capacity,
      notes: body.notes,
    })
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
