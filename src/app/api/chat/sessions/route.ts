import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { listChatSessions, createChatSession } from '@/lib/supabase/chat-sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ sessions: [] })
  try {
    const sessions = await listChatSessions()
    return NextResponse.json({ sessions })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  }
  try {
    const id = await createChatSession()
    return NextResponse.json({ id, title: '새 대화' })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
