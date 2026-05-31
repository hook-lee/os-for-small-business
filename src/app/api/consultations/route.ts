import { NextResponse } from 'next/server'
import { fetchAllConsultations, createConsultation } from '@/lib/supabase/consultations'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ consultations: [] })
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const consultations = await fetchAllConsultations(ownerId)
    return NextResponse.json({ consultations })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as {
      name?: string
      phone?: string | null
      consultationDate?: string
      inflowChannel?: string | null
      content?: string | null
      staffName?: string | null
      staffId?: number | null
      memo?: string | null
    }
    if (!body.name || !body.consultationDate) {
      return NextResponse.json({ error: 'name, consultationDate 필수' }, { status: 400 })
    }
    const id = await createConsultation({
      name: body.name,
      phone: body.phone ?? null,
      consultationDate: body.consultationDate,
      inflowChannel: body.inflowChannel ?? null,
      content: body.content ?? null,
      staffName: body.staffName ?? null,
      staffId: body.staffId ?? null,
      memo: body.memo ?? null,
    }, ownerId)
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
