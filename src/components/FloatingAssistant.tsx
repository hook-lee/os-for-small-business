'use client'

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'
import {
  listSessions,
  getSession,
  getCurrentSessionId,
  setCurrentSessionId,
  createSession,
  updateSessionMessages,
  deleteSession,
  type ChatSession,
  type SessionMessage,
} from '@/lib/storage/assistant-sessions'

type Role = 'user' | 'model'

interface Message {
  role: Role
  text: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
}

const PAGE_EXAMPLES: Record<string, string[]> = {
  '/': ['이번 달 매출이랑 지출 알려줘', '다음 분기 부가세 얼마 적립?', '올해 종소세 예상?'],
  '/tax': ['올해 종소세 예상?', '간이로 바꾸면 부가세 얼마 줄어?', '청년창업감면 얼마 절감 중?'],
  '/finances': ['이번 달 매출이랑 지출', '광고비 어디에 제일 많이 썼어?', '권장 예비비 얼마?'],
  '/sales': ['이번 분기 매출 추이', '신규결제 vs 재결제 비율'],
  '/analytics': ['회원 활성도 어때?', '강사별 매출 기여도'],
  '/add': ['이 거래 카테고리 뭐가 맞아?', '비슷한 거래 과거에 있었어?'],
  '/members': ['휴면 회원 누구?', '활성 수강권 만료 임박한 회원'],
  '/instructors': ['김우영 강사 이번 달 급여?', '강사별 회원 수'],
  '/lessons': ['이번 주 노쇼 얼마나 있었어?', '최근 7일 수업 통계'],
  '/payroll': ['이번 달 총 강사료 얼마?', '3.3% 원천징수 합계'],
}

function getPageExamples(pathname: string): string[] {
  if (PAGE_EXAMPLES[pathname]) return PAGE_EXAMPLES[pathname]
  for (const [key, exs] of Object.entries(PAGE_EXAMPLES)) {
    if (key !== '/' && pathname.startsWith(key)) return exs
  }
  return PAGE_EXAMPLES['/']
}

function getPageLabel(pathname: string): string {
  if (pathname === '/') return '홈'
  if (pathname.startsWith('/tax')) return '세금'
  if (pathname.startsWith('/finances/categories')) return '카테고리'
  if (pathname.startsWith('/finances')) return '재무'
  if (pathname.startsWith('/sales')) return '매출'
  if (pathname.startsWith('/analytics')) return '분석'
  if (pathname.startsWith('/add')) return '거래 입력'
  if (pathname.startsWith('/members')) return '회원'
  if (pathname.startsWith('/instructors')) return '강사'
  if (pathname.startsWith('/lessons')) return '수업'
  if (pathname.startsWith('/payroll')) return '급여'
  if (pathname.startsWith('/settings')) return '설정'
  return '워크스페이스'
}

function renderText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-neutral-100 px-1 rounded text-[11px]">$1</code>')
    .replace(/\n/g, '<br/>')
}

function fmtRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  return iso.slice(0, 10)
}

export function FloatingAssistant() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isMember = pathname?.startsWith('/m/')

  // 마운트 시: 마지막 세션 로드 또는 비어둠 (open하면 새 세션 생성)
  useEffect(() => {
    if (isMember) return
    const list = listSessions()
    setSessions(list)
    const lastId = getCurrentSessionId()
    if (lastId) {
      const s = getSession(lastId)
      if (s) {
        setCurrentId(s.id)
        setMessages(s.messages.map(m => ({ role: m.role, text: m.text, toolCalls: m.toolCalls })))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, open])

  useEffect(() => {
    if (open && !showHistory) inputRef.current?.focus()
  }, [open, showHistory])

  function ensureSession(): string {
    if (currentId) return currentId
    const fresh = createSession()
    setSessions(prev => [fresh, ...prev])
    setCurrentId(fresh.id)
    return fresh.id
  }

  // 메시지 변경 시 자동 저장 (throttle 안 함 — localStorage 빠름)
  const persistMessages = useCallback((id: string, msgs: Message[]) => {
    const sessionMsgs: SessionMessage[] = msgs.map(m => ({
      role: m.role,
      text: m.text,
      toolCalls: m.toolCalls,
      ts: new Date().toISOString(),
    }))
    updateSessionMessages(id, sessionMsgs)
    setSessions(listSessions())
  }, [])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const sid = ensureSession()
    setError('')
    setInput('')
    const userMsg: Message = { role: 'user', text: trimmed }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    persistMessages(sid, newMessages)
    setSending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages.map(m => ({ role: m.role, text: m.text })),
          context: { pathname, pageLabel: getPageLabel(pathname || '/') },
        }),
      })
      const json = await res.json() as { reply?: string; toolCalls?: Array<{ name: string; args: Record<string, unknown> }>; error?: string }
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`)
        return
      }
      const reply: Message = {
        role: 'model',
        text: json.reply ?? '(빈 답변)',
        toolCalls: json.toolCalls,
      }
      const finalMessages = [...newMessages, reply]
      setMessages(finalMessages)
      persistMessages(sid, finalMessages)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  function startNewSession() {
    const fresh = createSession()
    setSessions(prev => [fresh, ...prev])
    setCurrentId(fresh.id)
    setMessages([])
    setError('')
    setShowHistory(false)
  }

  function openSession(s: ChatSession) {
    setCurrentId(s.id)
    setCurrentSessionId(s.id)
    setMessages(s.messages.map(m => ({ role: m.role, text: m.text, toolCalls: m.toolCalls })))
    setError('')
    setShowHistory(false)
  }

  function removeSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('이 대화를 삭제할까요? (복구 불가)')) return
    deleteSession(id)
    setSessions(listSessions())
    if (id === currentId) {
      setCurrentId(null)
      setMessages([])
    }
  }

  if (isMember) return null

  const examples = getPageExamples(pathname || '/')
  const pageLabel = getPageLabel(pathname || '/')
  const currentSession = currentId ? sessions.find(s => s.id === currentId) : null

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 group flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all px-4 py-3"
          aria-label="AI 비서 열기"
        >
          <span className="text-lg">💬</span>
          <span className="text-sm font-semibold">AI 비서</span>
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5 ml-1">{pageLabel}</span>
          {sessions.length > 0 && (
            <span className="text-[10px] bg-emerald-400 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold ml-0.5" title={`저장된 대화 ${sessions.length}개`}>
              {sessions.length > 9 ? '9+' : sessions.length}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-5 right-5 z-50 bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden animate-slide-up"
          style={{
            width: 'min(440px, calc(100vw - 32px))',
            height: 'min(660px, calc(100vh - 80px))',
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-3 py-2.5 flex items-center justify-between shrink-0">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="flex-1 text-left min-w-0 hover:bg-white/10 rounded px-2 py-1 -mx-1 transition-colors"
              title="대화 목록"
            >
              <div className="text-sm font-bold flex items-center gap-1.5 min-w-0">
                <span className="shrink-0">💬</span>
                <span className="truncate">{currentSession?.title || 'AI 비서'}</span>
                <span className="text-[10px] opacity-70 shrink-0">{showHistory ? '▴' : '▾'}</span>
              </div>
              <div className="text-[10px] opacity-80">
                현재: {pageLabel} · 저장된 대화 {sessions.length}개
              </div>
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={startNewSession}
                className="text-[11px] bg-white/20 hover:bg-white/30 rounded px-2 py-1 font-medium"
                title="새 대화 시작"
              >
                + 새 대화
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-white/20"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
          </div>

          {/* History panel (toggle) */}
          {showHistory && (
            <div className="border-b border-neutral-200 bg-neutral-50 max-h-[60%] overflow-y-auto shrink-0">
              {sessions.length === 0 ? (
                <div className="text-xs text-neutral-400 text-center py-6">저장된 대화 없음</div>
              ) : (
                <div className="divide-y divide-neutral-200">
                  {sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => openSession(s)}
                      className={`w-full text-left px-3 py-2 hover:bg-white transition-colors flex items-start justify-between gap-2 ${
                        s.id === currentId ? 'bg-violet-50 border-l-2 border-violet-500' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-neutral-800 truncate">{s.title}</div>
                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          {fmtRelative(s.updatedAt)} · {s.messageCount}개 메시지
                        </div>
                      </div>
                      <button
                        onClick={e => removeSession(s.id, e)}
                        className="text-[10px] text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 shrink-0"
                        title="이 대화 삭제"
                      >
                        삭제
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {!showHistory && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-neutral-50">
              {messages.length === 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs text-neutral-500 text-center mt-2 px-2">
                    <strong>{pageLabel}</strong> 화면을 보고 계시네요.<br />
                    관련 질문 추천:
                  </div>
                  <div className="space-y-1.5">
                    {examples.map(ex => (
                      <button
                        key={ex}
                        onClick={() => send(ex)}
                        disabled={sending}
                        className="block w-full text-left text-xs text-neutral-700 bg-white border border-neutral-200 rounded-lg px-3 py-2 hover:bg-violet-50 hover:border-violet-300 transition-colors disabled:opacity-50"
                      >
                        💬 {ex}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-neutral-400 text-center pt-2 border-t border-neutral-200 mt-2">
                    직접 한국어로 자유롭게 물어보세요 · 대화는 자동 저장
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-violet-600 text-white'
                      : 'bg-white border border-neutral-200 text-neutral-800'
                  }`}>
                    {m.role === 'model' && m.toolCalls && m.toolCalls.length > 0 && (
                      <div className="text-[9px] text-neutral-400 mb-1 border-b border-neutral-100 pb-1">
                        🔧 {m.toolCalls.map(t => t.name).join(' → ')}
                      </div>
                    )}
                    <div dangerouslySetInnerHTML={{ __html: renderText(m.text) }} />
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-neutral-200 rounded-2xl px-3 py-2 text-xs text-neutral-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                      <span className="ml-1.5">생각 중...</span>
                    </span>
                  </div>
                </div>
              )}
              {error && (
                <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-2">
                  ⚠ {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input (history 모드에선 숨김) */}
          {!showHistory && (
            <div className="border-t border-neutral-200 p-2 bg-white shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={sending}
                  rows={2}
                  placeholder={`${pageLabel}에 대해 물어보세요 (Enter 전송)`}
                  className="flex-1 resize-none border border-neutral-300 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-neutral-50"
                />
                <button
                  onClick={() => send(input)}
                  disabled={sending || !input.trim()}
                  className="bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium px-3 py-1.5 rounded-lg text-xs shrink-0"
                >
                  전송
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.2s ease-out;
        }
      `}</style>
    </>
  )
}
