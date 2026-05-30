import { NextResponse } from 'next/server'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { loadStudioSettings, saveStudioSettings, type StudioSettings } from '@/lib/supabase/studio-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const settings = await loadStudioSettings(ownerId)
    return NextResponse.json({ settings })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as Partial<StudioSettings>
    await saveStudioSettings(body, ownerId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
