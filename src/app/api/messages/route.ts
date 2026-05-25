import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { createMessage, fetchRecentMessages, type CreateMessageInput } from '@/lib/supabase/messages'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ messages: [] })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const messages = await fetchRecentMessages(ownerId, 50)
    return NextResponse.json({ messages })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as Partial<CreateMessageInput> & { body?: string }
    if (!body.body || !body.recipientGroup) {
      return NextResponse.json({ error: 'body, recipientGroup 필수' }, { status: 400 })
    }
    const id = await createMessage({
      recipientGroup: body.recipientGroup,
      recipientIds: body.recipientIds ?? [],
      subject: body.subject,
      body: body.body,
      status: body.status ?? 'draft',
      memo: body.memo,
    }, ownerId)
    return NextResponse.json({ ok: true, id })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}
