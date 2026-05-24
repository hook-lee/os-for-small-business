/**
 * AI 비서 대화 세션 localStorage 영속화.
 *
 * 영속 위치: 사용자 브라우저 localStorage (서버 X)
 * 한계: 다른 기기에선 안 보임. 브라우저 데이터 지우면 사라짐.
 * 장점: DB 없이 즉시 동작. 빠름. 프라이버시.
 *
 * 추후: 같은 인터페이스로 Supabase 동기화 추가 가능 (chat_sessions/messages 테이블)
 */

const LS_KEY = 'rapa.assistant.sessions.v1'
const LS_CURRENT_KEY = 'rapa.assistant.current.v1'
const MAX_SESSIONS = 50          // 최대 보관 세션 수
const MAX_TITLE_LEN = 30

export interface SessionMessage {
  role: 'user' | 'model'
  text: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
  ts: string                     // ISO timestamp
}

export interface ChatSession {
  id: string                     // uuid (crypto.randomUUID)
  title: string                  // 첫 user 메시지에서 자동 추출
  createdAt: string
  updatedAt: string
  messageCount: number
  messages: SessionMessage[]
}

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function safeRead<T>(key: string, fallback: T): T {
  if (!isClient()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeWrite(key: string, value: unknown): void {
  if (!isClient()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // QuotaExceededError 등 → 무시. 다음 저장 때 sessions trim 시도
  }
}

function newId(): string {
  if (isClient() && typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function deriveTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.trim().replace(/\s+/g, ' ')
  if (cleaned.length <= MAX_TITLE_LEN) return cleaned
  return cleaned.slice(0, MAX_TITLE_LEN) + '…'
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

export function listSessions(): ChatSession[] {
  const all = safeRead<ChatSession[]>(LS_KEY, [])
  return [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getSession(id: string): ChatSession | null {
  const all = safeRead<ChatSession[]>(LS_KEY, [])
  return all.find(s => s.id === id) ?? null
}

export function getCurrentSessionId(): string | null {
  if (!isClient()) return null
  return window.localStorage.getItem(LS_CURRENT_KEY)
}

export function setCurrentSessionId(id: string | null): void {
  if (!isClient()) return
  if (id) window.localStorage.setItem(LS_CURRENT_KEY, id)
  else window.localStorage.removeItem(LS_CURRENT_KEY)
}

export function createSession(): ChatSession {
  const now = new Date().toISOString()
  const session: ChatSession = {
    id: newId(),
    title: '새 대화',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    messages: [],
  }
  const all = safeRead<ChatSession[]>(LS_KEY, [])
  all.unshift(session)
  // 최대치 초과 시 가장 오래된 것 제거
  if (all.length > MAX_SESSIONS) all.length = MAX_SESSIONS
  safeWrite(LS_KEY, all)
  setCurrentSessionId(session.id)
  return session
}

/**
 * 세션의 메시지 전체를 덮어쓰기. title은 첫 user 메시지 기반으로 자동 갱신.
 */
export function updateSessionMessages(id: string, messages: SessionMessage[]): void {
  const all = safeRead<ChatSession[]>(LS_KEY, [])
  const idx = all.findIndex(s => s.id === id)
  if (idx < 0) return
  const existing = all[idx]
  const firstUserMsg = messages.find(m => m.role === 'user')
  const title = firstUserMsg && existing.title === '새 대화'
    ? deriveTitle(firstUserMsg.text)
    : existing.title
  all[idx] = {
    ...existing,
    title,
    updatedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages,
  }
  safeWrite(LS_KEY, all)
}

export function deleteSession(id: string): void {
  const all = safeRead<ChatSession[]>(LS_KEY, [])
  const filtered = all.filter(s => s.id !== id)
  safeWrite(LS_KEY, filtered)
  if (getCurrentSessionId() === id) setCurrentSessionId(null)
}

export function renameSession(id: string, newTitle: string): void {
  const all = safeRead<ChatSession[]>(LS_KEY, [])
  const idx = all.findIndex(s => s.id === id)
  if (idx < 0) return
  all[idx] = { ...all[idx], title: newTitle.trim() || '새 대화', updatedAt: new Date().toISOString() }
  safeWrite(LS_KEY, all)
}

export function clearAllSessions(): void {
  if (!isClient()) return
  window.localStorage.removeItem(LS_KEY)
  window.localStorage.removeItem(LS_CURRENT_KEY)
}
