import { NextResponse } from 'next/server'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { fetchNotesByMember, createMemberNote } from '@/lib/supabase/member-notes'
import { resolveAuthorInstructorId } from '@/lib/supabase/studio-context'

async function authGuard(): Promise<{ ownerId: string } | NextResponse> {
  try {
    const ownerId = await requireOwnerId()
    return { ownerId }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function GET(req: Request) {
  const auth = await authGuard()
  if (auth instanceof NextResponse) return auth
  const memberId = Number(new URL(req.url).searchParams.get('memberId'))
  if (!Number.isFinite(memberId) || memberId <= 0) {
    return NextResponse.json({ error: 'memberId 필수' }, { status: 400 })
  }
  try {
    const notes = await fetchNotesByMember(memberId, auth.ownerId)
    return NextResponse.json({ notes })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await authGuard()
  if (auth instanceof NextResponse) return auth
  try {
    const body = await req.json() as {
      memberId?: number
      noteDate?: string
      content?: string
      tags?: string[]
      authorInstructorId?: number | null
      lessonId?: number | null
    }
    if (!body.memberId || !body.noteDate || !body.content?.trim()) {
      return NextResponse.json({ error: 'memberId, noteDate, content 필수' }, { status: 400 })
    }
    // 강사로 로그인한 경우 작성자는 본인으로 강제. 원장이면 폼에서 고른 강사 사용.
    const authorInstructorId = await resolveAuthorInstructorId(body.authorInstructorId ?? null)
    const id = await createMemberNote(
      {
        memberId: body.memberId,
        noteDate: body.noteDate,
        content: body.content.trim(),
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 10) : [],
        authorInstructorId,
        lessonId: body.lessonId ?? null,
      },
      auth.ownerId,
    )
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
