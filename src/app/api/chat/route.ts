import { NextResponse } from 'next/server'
import { chatWithTools, hasGeminiKey, type ChatMessage } from '@/lib/ai/gemini'
import { ALL_TOOLS } from '@/lib/ai/tools'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'

export const runtime = 'nodejs'   // supabase + tool exec
export const dynamic = 'force-dynamic'

interface ChatRequestBody {
  message: string
  history?: ChatMessage[]
  context?: { pathname?: string; pageLabel?: string }
}

export async function POST(req: Request) {
  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY 미설정. .env.local에 추가 후 서버 재시작 필요.' },
      { status: 503 },
    )
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
  // history 정제 (최근 12턴만)
  const history = (body.history ?? []).slice(-12).filter(m =>
    (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.length > 0,
  )

  try {
    const result = await chatWithTools({
      systemInstruction: buildSystemPrompt(body.context ?? {}),
      history,
      userMessage: message,
      tools: ALL_TOOLS,
    })
    return NextResponse.json({
      reply: result.reply,
      toolCalls: result.toolCalls.map(t => ({ name: t.name, args: t.args })),
    })
  } catch (error) {
    const msg = (error as Error).message ?? 'unknown'
    console.error('[/api/chat]', msg)
    // Gemini API 일반적 에러 메시지를 사용자 친화적으로
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
      return NextResponse.json({ error: 'API 키가 유효하지 않습니다. .env.local의 GEMINI_API_KEY를 확인하세요.' }, { status: 401 })
    }
    if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({ error: 'Gemini 무료 한도 초과. 분당 15회/일 1500회 제한입니다. 잠시 후 다시 시도하세요.' }, { status: 429 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
