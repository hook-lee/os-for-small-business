'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { usePathname } from 'next/navigation'

type Role = 'user' | 'model'

interface Message {
  role: Role
  text: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
}

// 페이지별 맞춤 예시 — 현재 보고 있는 화면에 어울리는 질문
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
  // exact match 먼저
  if (PAGE_EXAMPLES[pathname]) return PAGE_EXAMPLES[pathname]
  // prefix match
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

export function FloatingAssistant() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // member 페이지는 비서 숨김
  const isMember = pathname?.startsWith('/m/')

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setError('')
    setInput('')
    const userMsg: Message = { role: 'user', text: trimmed }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
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
      setMessages(prev => [...prev, {
        role: 'model',
        text: json.reply ?? '(빈 답변)',
        toolCalls: json.toolCalls,
      }])
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

  function clearChat() {
    setMessages([])
    setError('')
  }

  if (isMember) return null   // member-side 페이지에선 숨김

  const examples = getPageExamples(pathname || '/')
  const pageLabel = getPageLabel(pathname || '/')

  return (
    <>
      {/* === Floating Button (닫힘 상태) === */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 group flex items-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all px-4 py-3"
          aria-label="AI 비서 열기"
          title="AI 비서 (현재 보고 있는 화면: ' + pageLabel + ')"
        >
          <span className="text-lg">💬</span>
          <span className="text-sm font-semibold">AI 비서</span>
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5 ml-1">{pageLabel}</span>
        </button>
      )}

      {/* === Chat Card (열림 상태) === */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-50 bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden animate-slide-up"
          style={{
            width: 'min(420px, calc(100vw - 32px))',
            height: 'min(640px, calc(100vh - 80px))',
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                <span>💬</span> AI 비서
              </div>
              <div className="text-[10px] opacity-80">현재: {pageLabel} · DB read-only · Gemini 2.5 Flash</div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-[10px] bg-white/20 hover:bg-white/30 rounded px-2 py-1"
                  title="대화 초기화"
                >
                  초기화
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-white/20"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-neutral-50">
            {messages.length === 0 && (
              <div className="space-y-2.5">
                <div className="text-xs text-neutral-500 text-center mt-2 px-2">
                  <strong>{pageLabel}</strong> 화면을 보고 계시네요.<br />
                  관련된 질문 추천:
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
                  또는 직접 한국어로 자유롭게 물어보세요
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

          {/* Input */}
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
        </div>
      )}

      {/* Slide-up animation */}
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
