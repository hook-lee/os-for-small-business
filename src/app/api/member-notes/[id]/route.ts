import { NextResponse } from 'next/server'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { updateMemberNote, deleteMemberNote } from '@/lib/supabase/member-notes'

async function authGuard(): Promise<{ ownerId: string } | NextResponse> {
  try {
    const ownerId = await requireOwnerId()
    return { ownerId }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authGuard()
  if (auth instanceof NextResponse) return auth
  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  try {
    const body = await req.json() as {
      noteDate?: string
      content?: string
      tags?: string[]
      authorInstructorId?: number | null
    }
    await updateMemberNote(id, {
      noteDate: body.noteDate,
      content: body.content?.trim(),
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 10) : undefined,
      authorInstructorId: body.authorInstructorId,
    }, auth.ownerId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authGuard()
  if (auth instanceof NextResponse) return auth
  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  try {
    await deleteMemberNote(id, auth.ownerId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
