import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { setLessonStatus, deleteLesson, type LessonStatus } from '@/lib/supabase/lessons'

const VALID_STATUSES: LessonStatus[] = ['scheduled', 'completed', 'cancelled_same_day', 'cancelled_advance', 'noshow']

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    const body = await req.json() as { status?: string }
    if (!body.status || !VALID_STATUSES.includes(body.status as LessonStatus)) {
      return NextResponse.json({ error: '유효하지 않은 status' }, { status: 400 })
    }
    const result = await setLessonStatus(id, body.status as LessonStatus)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    const result = await deleteLesson(id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
