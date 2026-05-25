import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { deleteTransaction } from '@/lib/supabase/transactions'
import { invalidateCache } from '@/lib/data/loader'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { error: 'Supabase 미설정 — SUPABASE_URL/SERVICE_ROLE_KEY 환경변수 필요' },
      { status: 503 },
    )
  }
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  }
  try {
    await deleteTransaction(id, ownerId)
    invalidateCache(ownerId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
