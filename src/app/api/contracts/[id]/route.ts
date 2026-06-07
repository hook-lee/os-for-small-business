import { NextResponse } from 'next/server'
import { requireOwnerId, getStudioContext } from '@/lib/supabase/auth-server'
import { agreeContract, deleteContract } from '@/lib/supabase/contracts'

async function managerGuard(): Promise<{ ownerId: string } | NextResponse> {
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const studio = await getStudioContext()
    if (studio.role === 'instructor') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { ownerId }
}

// 계약 삭제 (잘못 보냈거나 중복)
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await managerGuard()
  if (auth instanceof NextResponse) return auth
  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  try {
    await deleteContract(id, auth.ownerId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

// 원장이 직접 동의 처리 (종이로 받았을 때) — 이름 + (선택)서류 첨부
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await managerGuard()
  if (auth instanceof NextResponse) return auth
  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  try {
    const body = await req.json() as {
      name?: string
      signatureData?: string | null
      attachment?: { data: string; name: string } | null
    }
    if (!body.name?.trim()) return NextResponse.json({ error: '동의자 성명을 입력해주세요' }, { status: 400 })
    // 첨부 크기 가드 (base64 약 4MB 상한)
    if (body.attachment?.data && body.attachment.data.length > 4_000_000) {
      return NextResponse.json({ error: '첨부파일이 너무 커요 (약 3MB 이하 권장)' }, { status: 413 })
    }
    await agreeContract(id, auth.ownerId, body.name.trim(), body.signatureData ?? null, body.attachment ?? null)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
