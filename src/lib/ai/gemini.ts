/**
 * Gemini 클라이언트 래퍼.
 *
 * 추상화 의도:
 * - tool 정의/실행/대화 루프를 한 곳에 캡슐화
 * - 추후 Claude/OpenAI로 교체 시 src/lib/ai/ 안만 갈아끼움
 *
 * 사용: server-side만 (GEMINI_API_KEY 노출 X)
 */
import { GoogleGenerativeAI, SchemaType, type FunctionCall, type FunctionDeclaration, type GenerateContentResult, type Tool } from '@google/generative-ai'

const MODEL = 'gemini-2.5-flash'   // 무료 한도 + 충분한 추론
const MAX_TOOL_ITERATIONS = 8       // 무한 루프 가드

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

export interface ToolHandler {
  name: string
  declaration: FunctionDeclaration
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

export interface ChatOptions {
  systemInstruction: string
  history?: ChatMessage[]
  userMessage: string
  tools: ToolHandler[]
}

export interface ChatResult {
  reply: string
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }>
}

export function hasGeminiKey(): boolean {
  return typeof process.env.GEMINI_API_KEY === 'string' && process.env.GEMINI_API_KEY.length > 0
}

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않음 (.env.local 확인)')
  return new GoogleGenerativeAI(key)
}

/**
 * 1턴 대화. tool calling 발생 시 자동으로 함수 실행 + 결과 재전달 (multi-step).
 */
export async function chatWithTools(opts: ChatOptions): Promise<ChatResult> {
  const genAI = getClient()
  const toolMap = new Map(opts.tools.map(t => [t.name, t]))

  const tool: Tool = {
    functionDeclarations: opts.tools.map(t => t.declaration),
  }

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: opts.systemInstruction,
    tools: [tool],
  })

  // history → Gemini format
  const historyForGemini = (opts.history ?? []).map(m => ({
    role: m.role,
    parts: [{ text: m.text }],
  }))

  const chat = model.startChat({ history: historyForGemini })
  const toolCalls: ChatResult['toolCalls'] = []

  let result: GenerateContentResult = await chat.sendMessage(opts.userMessage)

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const response = result.response
    const calls = response.functionCalls?.() as FunctionCall[] | undefined
    if (!calls || calls.length === 0) {
      // 모델이 최종 텍스트 답변 줌
      return { reply: response.text(), toolCalls }
    }

    // 모든 함수 호출 병렬 실행
    const functionResponses = await Promise.all(
      calls.map(async call => {
        const handler = toolMap.get(call.name)
        let resultData: unknown
        if (!handler) {
          resultData = { error: `Unknown tool: ${call.name}` }
        } else {
          try {
            resultData = await handler.execute(call.args as Record<string, unknown>)
          } catch (e) {
            resultData = { error: (e as Error).message }
          }
        }
        toolCalls.push({ name: call.name, args: call.args as Record<string, unknown>, result: resultData })
        return {
          functionResponse: {
            name: call.name,
            response: { result: resultData },
          },
        }
      }),
    )

    // 결과를 모델에 전달, 다음 답변 받기
    result = await chat.sendMessage(functionResponses)
  }

  return {
    reply: '⚠ tool 호출 한도(8회)에 도달했습니다. 질문을 단순화해 다시 시도해주세요.',
    toolCalls,
  }
}

export { SchemaType }
