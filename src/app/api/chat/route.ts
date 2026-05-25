import { NextResponse } from 'next/server'
import { chatWithTools, hasGeminiKey, type ChatMessage as GeminiMessage } from '@/lib/ai/gemini'
import { buildTools } from '@/lib/ai/tools'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import {
  createChatSession,
  appendChatMessage,
  fetchChatSession,
} from '@/lib/supabase/chat-sessions'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { loadProfile } from '@/lib/profile/settings'
import { checkRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ChatRequestBody {
  message: string
  sessionId?: number | null   // 없으면 새 세션 생성, 응답에 새 id 반환
  context?: { pathname?: string; pageLabel?: string }
}

export async function POST(req: Request) {
  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY 미설정. .env.local에 추가 후 서버 재시작 필요.' },
      { status: 503 },
    )
  }
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  // Rate limit: 분당 10회 / 시간당 60회 (사용자별)
  if (!checkRateLimit(`chat:${ownerId}:m`, 10, 60_000)) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요 (분당 10회 제한)' }, { status: 429 })
  }
  if (!checkRateLimit(`chat:${ownerId}:h`, 60, 60 * 60_000)) {
    return NextResponse.json({ error: '시간당 60회 한도 초과. 1시간 후 재시도하세요.' }, { status: 429 })
  }
  let body: ChatRequestBody
  try {
    body = await req.json() as ChatRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const message = (body.message ?? '').trim()
  if (!message) {
    return NextResponse.json({ error: 'message 필수' }, { status: 400 })
  }

  // 1. 세션 확보 (없으면 신규 생성)
  let sessionId = body.sessionId ?? null
  let history: GeminiMessage[] = []

  if (hasSupabaseConfig()) {
    try {
      if (!sessionId) {
        sessionId = await createChatSession(ownerId)
      } else {
        // 기존 세션 → 메시지 가져와서 history 구성
        const data = await fetchChatSession(sessionId, ownerId)
        if (data) {
          // 최근 12턴만 (LLM 컨텍스트 절약)
          history = data.messages.slice(-12).map(m => ({ role: m.role, text: m.text }))
        } else {
          // 세션 id가 유효하지 않으면 새로 생성
          sessionId = await createChatSession(ownerId)
        }
      }
      // user 메시지 영속화 (Gemini 호출 실패해도 user 발언은 남김)
      await appendChatMessage(sessionId, 'user', message, null, ownerId)
    } catch (e) {
      // DB 저장 실패는 치명적이지 않음 — 로그만 남기고 Gemini는 시도
      console.warn('[/api/chat] session persist failed:', (e as Error).message)
    }
  }

  // 2. workspace_name 가져와서 system prompt에 주입
  let workspaceName: string | null = null
  try {
    const profile = await loadProfile(ownerId)
    workspaceName = profile.workspaceName
  } catch { /* graceful */ }

  // 3. Gemini 호출
  try {
    const result = await chatWithTools({
      systemInstruction: buildSystemPrompt({ ...(body.context ?? {}), workspaceName }),
      history,
      userMessage: message,
      tools: buildTools(ownerId),
    })

    // 3. model 답변 영속화
    if (sessionId && hasSupabaseConfig()) {
      try {
        const toolCalls = result.toolCalls.map(t => ({ name: t.name, args: t.args }))
        await appendChatMessage(sessionId, 'model', result.reply, toolCalls.length > 0 ? toolCalls : null, ownerId)
      } catch (e) {
        console.warn('[/api/chat] model reply persist failed:', (e as Error).message)
      }
    }

    return NextResponse.json({
      sessionId,
      reply: result.reply,
      toolCalls: result.toolCalls.map(t => ({ name: t.name, args: t.args })),
    })
  } catch (error) {
    const msg = (error as Error).message ?? 'unknown'
    console.error('[/api/chat]', msg)
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
      return NextResponse.json({ error: 'API 키가 유효하지 않습니다. .env.local의 GEMINI_API_KEY를 확인하세요.', sessionId }, { status: 401 })
    }
    if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({ error: 'Gemini 무료 한도 초과. 분당 15회/일 1500회 제한입니다. 잠시 후 다시 시도하세요.', sessionId }, { status: 429 })
    }
    return NextResponse.json({ error: msg, sessionId }, { status: 500 })
  }
}
