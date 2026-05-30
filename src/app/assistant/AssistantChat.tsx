'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Card } from '@/components/ui/Card'

type Role = 'user' | 'model'

interface Message {
  role: Role
  text: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
}

const EXAMPLES = [
  '이번 달 매출이랑 지출 알려줘',
  '5월 광고선전비 얼마 썼어?',
  '김우영 강사 이번 달 급여 얼마 나가?',
  '다음 분기 부가세 얼마 적립해야 해?',
  '올해 종소세 예상 얼마?',
  '회원 박지영 활성 수강권 보여줘',
]

import { renderSafeMarkdown as renderText } from '@/lib/security/sanitize'

export function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

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
        }),
      })
      const json = await res.json() as { reply?: string; toolCalls?: Array<{ name: string; args: Record<string, unknown> }>; error?: string }
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`)
        // 사용자 메시지는 유지하지만 답변은 추가 X (재시도 가능)
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
    if (!confirm('대화 내역을 모두 지울까요?')) return
    setMessages([])
    setError('')
  }

  return (
    <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-sm text-neutral-500 text-center mt-8">
              아무거나 물어보세요. 실제 DB 데이터로 답합니다.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto">
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  disabled={sending}
                  className="text-left text-xs text-neutral-700 bg-white border border-neutral-200 rounded-lg px-3 py-2 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
                >
                  💬 {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-neutral-200 text-neutral-800'
            }`}>
              {m.role === 'model' && m.toolCalls && m.toolCalls.length > 0 && (
                <div className="text-[10px] text-neutral-400 mb-1.5 border-b border-neutral-100 pb-1">
                  🔧 {m.toolCalls.map(t => t.name).join(' → ')}
                </div>
              )}
              <div dangerouslySetInnerHTML={{ __html: renderText(m.text) }} />
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-neutral-200 rounded-2xl px-4 py-2.5 text-sm text-neutral-400">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-pulse" />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                <span className="ml-2">생각 중... (DB 조회 + Gemini 호출)</span>
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
            ⚠ {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 p-3 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={sending}
            rows={2}
            placeholder="질문을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
            className="flex-1 resize-none border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50"
          />
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-4 py-2 rounded-lg text-sm shrink-0"
          >
            전송
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-neutral-400">
          <span>Gemini 2.5 Flash · 무료 한도 1500/일 · DB read-only</span>
          {messages.length > 0 && (
            <button onClick={clearChat} className="hover:text-red-600">대화 초기화</button>
          )}
        </div>
      </div>
    </Card>
  )
}
