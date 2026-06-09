import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { deletePass, updatePass } from '@/lib/supabase/passes'
import { deleteTransactionsByPass } from '@/lib/supabase/transactions'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { invalidateCache } from '@/lib/data/loader'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    const body = await req.json() as {
      instructorId?: number | null
      status?: string
      remainingCount?: number
      availableCount?: number
      cancellableCount?: number
      endDate?: string
      paymentAmount?: number
    }
    await updatePass(id, body, ownerId)
    // 환불 처리 시 발급 때 자동생성된 매출(v3.7)을 제거 — 환불은 매출이 아니므로.
    // ('이용만료' 등 다른 비활성 상태는 결제가 유효 → 매출 유지)
    if (body.status === '환불') {
      await deleteTransactionsByPass(id, ownerId)
    }
    invalidateCache(ownerId)   // 재무·세금 화면 즉시 갱신
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    await deletePass(id, ownerId)
    // v3.7: 삭제 시 연결 매출도 함께 정리되므로 transactions 캐시 무효화
    invalidateCache(ownerId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
