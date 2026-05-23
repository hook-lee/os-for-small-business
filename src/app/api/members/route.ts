import { NextResponse } from 'next/server'
import { fetchAllMembers, insertMember, type NewMemberInput } from '@/lib/supabase/members'
import { hasSupabaseConfig } from '@/lib/supabase/client'

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ members: [] })
  }
  try {
    const members = await fetchAllMembers()
    return NextResponse.json({ members })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  try {
    const body = await req.json() as Partial<NewMemberInput> & { name?: string }
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: '이름 필수' }, { status: 400 })
    }
    const id = await insertMember({
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
      gender: body.gender ?? null,
      birthDate: body.birthDate ?? null,
      address: body.address ?? null,
      detailAddress: body.detailAddress ?? null,
      memo: body.memo ?? null,
      tier: body.tier ?? null,
      appConnected: body.appConnected ?? false,
    })
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
