import { NextResponse } from 'next/server'
import { requireOwnerId, getStudioContext } from '@/lib/supabase/auth-server'
import { loadContractTemplates, saveContractTemplate } from '@/lib/supabase/contracts'
import { isContractKind } from '@/lib/contracts/defaults'

async function guard(): Promise<{ ownerId: string } | NextResponse> {
  try { return { ownerId: await requireOwnerId() } }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function GET() {
  const auth = await guard()
  if (auth instanceof NextResponse) return auth
  try {
    const templates = await loadContractTemplates(auth.ownerId)
    return NextResponse.json({ templates })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await guard()
  if (auth instanceof NextResponse) return auth
  // 템플릿 편집은 원장/관리자만
  try {
    const studio = await getStudioContext()
    if (studio.role === 'instructor') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json() as { kind?: string; title?: string; body?: string }
    if (!body.kind || !isContractKind(body.kind) || !body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: 'kind, title, body 필수' }, { status: 400 })
    }
    await saveContractTemplate(auth.ownerId, body.kind, body.title.trim(), body.body)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
