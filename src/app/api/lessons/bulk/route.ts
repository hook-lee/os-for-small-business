import { NextResponse } from 'next/server'
import { hasSupabaseConfig, getSupabaseClient } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'

interface BulkLessonInput {
  memberId: number
  instructorId?: number | null
  passId?: number | null
  lessonTime?: string
  durationMinutes?: number
  memo?: string
  dates: string[]   // YYYY-MM-DD[]
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as Partial<BulkLessonInput>
    if (!body.memberId) return NextResponse.json({ error: 'memberId 필수' }, { status: 400 })
    if (!Array.isArray(body.dates) || body.dates.length === 0) {
      return NextResponse.json({ error: 'dates 배열 필수 (1개 이상)' }, { status: 400 })
    }
    // dates 유효성
    for (const d of body.dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return NextResponse.json({ error: `잘못된 날짜 형식: ${d}` }, { status: 400 })
      }
    }
    // 중복 제거
    const uniqueDates = Array.from(new Set(body.dates))

    const supabase = getSupabaseClient()
    const rows = uniqueDates.map(d => {
      const row: Record<string, unknown> = {
        pass_id: body.passId ?? null,
        member_id: body.memberId!,
        instructor_id: body.instructorId ?? null,
        lesson_date: d,
        lesson_time: body.lessonTime ?? null,
        duration_minutes: body.durationMinutes ?? 50,
        status: 'scheduled',
        deducted: false,
        memo: body.memo ?? null,
      }
      if (ownerId !== 'no-auth') row.owner_id = ownerId
      return row
    })
    const { data, error } = await supabase.from('lessons').insert(rows).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, count: data?.length ?? 0, ids: (data ?? []).map((r: { id: number }) => r.id) })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
