import { getSupabaseClient, hasSupabaseConfig } from './client'

const MAX_TITLE_LEN = 40

export interface ChatSessionMeta {
  id: number
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface ChatMessage {
  id: number
  sessionId: number
  role: 'user' | 'model'
  text: string
  toolCalls: Array<{ name: string; args: Record<string, unknown> }> | null
  createdAt: string
}

interface SessionRow {
  id: number
  title: string
  created_at: string
  updated_at: string
}

interface MessageRow {
  id: number
  session_id: number
  role: string
  text: string
  tool_calls: unknown
  created_at: string
}

function rowToMessage(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    sessionId: r.session_id,
    role: r.role === 'user' ? 'user' : 'model',
    text: r.text,
    toolCalls: (r.tool_calls as ChatMessage['toolCalls']) ?? null,
    createdAt: r.created_at,
  }
}

function deriveTitle(firstUserText: string): string {
  const cleaned = firstUserText.trim().replace(/\s+/g, ' ')
  if (cleaned.length <= MAX_TITLE_LEN) return cleaned
  return cleaned.slice(0, MAX_TITLE_LEN) + '…'
}

/**
 * 세션 목록 + 각 세션의 메시지 수 (group count).
 * Supabase는 group count를 직접 select 못 해서 일단 sessions + messages 각각 fetch.
 */
export async function listChatSessions(ownerId: string): Promise<ChatSessionMeta[]> {
  if (!hasSupabaseConfig()) return []
  try {
    const supabase = getSupabaseClient()
    let sQ = supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100)
    if (ownerId !== 'no-auth') sQ = sQ.eq('owner_id', ownerId)
    const { data: sessions, error } = await sQ
    if (error || !sessions) return []
    const sessionIds = (sessions as SessionRow[]).map(s => s.id)
    if (sessionIds.length === 0) return []
    // chat_messages는 owner_id 없음 — session_id로만 격리됨 (cascade)
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('session_id')
      .in('session_id', sessionIds)
    const counts = new Map<number, number>()
    for (const m of ((msgs ?? []) as Array<{ session_id: number }>)) {
      counts.set(m.session_id, (counts.get(m.session_id) ?? 0) + 1)
    }
    return (sessions as SessionRow[]).map(s => ({
      id: s.id,
      title: s.title,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      messageCount: counts.get(s.id) ?? 0,
    }))
  } catch {
    return []
  }
}

export async function fetchChatSession(id: number, ownerId: string): Promise<{ session: ChatSessionMeta; messages: ChatMessage[] } | null> {
  if (!hasSupabaseConfig()) return null
  try {
    const supabase = getSupabaseClient()
    let sQ = supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
      .eq('id', id)
    if (ownerId !== 'no-auth') sQ = sQ.eq('owner_id', ownerId)
    const { data: session, error: sErr } = await sQ.maybeSingle()
    if (sErr || !session) return null
    const { data: msgs, error: mErr } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true })
    if (mErr) return null
    const messages = ((msgs ?? []) as MessageRow[]).map(rowToMessage)
    const s = session as SessionRow
    return {
      session: {
        id: s.id,
        title: s.title,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        messageCount: messages.length,
      },
      messages,
    }
  } catch {
    return null
  }
}

export async function createChatSession(ownerId: string): Promise<number> {
  if (!hasSupabaseConfig()) throw new Error('Supabase 미설정')
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {}
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`세션 생성 실패: ${error.message}`)
  return (data as { id: number }).id
}

/**
 * 메시지 추가 + 세션 updated_at/title 자동 갱신.
 * 첫 user 메시지가 들어올 때 title이 '새 대화'면 자동 추출.
 */
export async function appendChatMessage(
  sessionId: number,
  role: 'user' | 'model',
  text: string,
  toolCalls: Array<{ name: string; args: Record<string, unknown> }> | null,
  ownerId: string,
): Promise<void> {
  if (!hasSupabaseConfig()) throw new Error('Supabase 미설정')
  const supabase = getSupabaseClient()
  // chat_messages는 owner_id 컬럼 없음 — session_id로 격리 (cascade)
  const { error: insertErr } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role,
      text,
      tool_calls: toolCalls,
    })
  if (insertErr) throw new Error(`메시지 저장 실패: ${insertErr.message}`)

  // session updated_at 갱신 + title 자동 추출 (필요 시)
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (role === 'user') {
    let titleQ = supabase
      .from('chat_sessions')
      .select('title')
      .eq('id', sessionId)
    if (ownerId !== 'no-auth') titleQ = titleQ.eq('owner_id', ownerId)
    const { data: sess } = await titleQ.maybeSingle()
    if (sess && (sess as { title: string }).title === '새 대화') {
      updates.title = deriveTitle(text)
    }
  }
  let updQ = supabase.from('chat_sessions').update(updates).eq('id', sessionId)
  if (ownerId !== 'no-auth') updQ = updQ.eq('owner_id', ownerId)
  await updQ
}

export async function renameChatSession(sessionId: number, title: string, ownerId: string): Promise<void> {
  if (!hasSupabaseConfig()) throw new Error('Supabase 미설정')
  const supabase = getSupabaseClient()
  const trimmed = title.trim() || '새 대화'
  let q = supabase
    .from('chat_sessions')
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`이름 변경 실패: ${error.message}`)
}

export async function deleteChatSession(sessionId: number, ownerId: string): Promise<void> {
  if (!hasSupabaseConfig()) throw new Error('Supabase 미설정')
  const supabase = getSupabaseClient()
  // chat_messages는 on delete cascade로 자동 정리됨
  let q = supabase.from('chat_sessions').delete().eq('id', sessionId)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`삭제 실패: ${error.message}`)
}
