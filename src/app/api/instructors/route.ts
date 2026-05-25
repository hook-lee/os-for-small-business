import { NextResponse } from 'next/server'
import { fetchAllInstructors, insertInstructor } from '@/lib/supabase/instructors'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ instructors: [] })
  }
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const instructors = await fetchAllInstructors(ownerId)
    return NextResponse.json({ instructors })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as { name?: string; phone?: string | null; role?: string; ratePrivate?: number; rateRehab?: number; rateDuet?: number; rateGroup?: number; color?: string | null }
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: '이름 필수' }, { status: 400 })
    }
    const role = body.role ?? 'instructor'
    if (!['owner', 'instructor', 'admin'].includes(role)) {
      return NextResponse.json({ error: '유효하지 않은 role' }, { status: 400 })
    }
    const id = await insertInstructor({
      name: body.name,
      phone: body.phone ?? null,
      role: role as 'owner' | 'instructor' | 'admin',
      ratePrivate: body.ratePrivate ?? 30000,
      rateRehab: body.rateRehab ?? 30000,
      rateDuet: body.rateDuet ?? 30000,
      rateGroup: body.rateGroup ?? 30000,
      color: body.color ?? null,
    }, ownerId)
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
