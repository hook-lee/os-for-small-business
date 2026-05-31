import { NextResponse } from 'next/server'
import { updateConsultation, deleteConsultation, convertConsultationToMember, type UpdateConsultationInput } from '@/lib/supabase/consultations'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    const raw = await req.json() as { action?: string } & UpdateConsultationInput
    if (raw.action === 'convert') {
      const result = await convertConsultationToMember(id, ownerId)
      return NextResponse.json({ ok: true, ...result })
    }
    // action 키 제외하고 patch만 전달
    const { action: _action, ...patch } = raw
    void _action
    await updateConsultation(id, patch, ownerId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  try {
    await deleteConsultation(id, ownerId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
