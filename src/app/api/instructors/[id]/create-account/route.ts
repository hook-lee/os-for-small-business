import { NextResponse } from 'next/server'
import { requireOwnerId, getStudioContext } from '@/lib/supabase/auth-server'
import { createInstructorLoginAccount } from '@/lib/supabase/instructor-accounts'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  // 강사 계정 발급은 원장/관리자만 (강사 본인은 못 만듦)
  try {
    const studio = await getStudioContext()
    if (studio.role === 'instructor') {
      return NextResponse.json({ error: '권한이 없습니다 (원장만 가능)' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idRaw } = await ctx.params
  const instructorId = Number(idRaw)
  if (!Number.isFinite(instructorId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  try {
    const body = await req.json() as { email?: string }
    const email = body.email?.trim().toLowerCase()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: '올바른 이메일을 입력해주세요' }, { status: 400 })
    }
    const result = await createInstructorLoginAccount(instructorId, email, ownerId)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
