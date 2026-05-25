import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { listChatSessions, createChatSession } from '@/lib/supabase/chat-sessions'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ sessions: [] })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const sessions = await listChatSessions(ownerId)
    return NextResponse.json({ sessions })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  }
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const id = await createChatSession(ownerId)
    return NextResponse.json({ id, title: '새 대화' })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
