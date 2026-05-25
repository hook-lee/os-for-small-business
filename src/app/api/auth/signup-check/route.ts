/**
 * 회원가입 rate limit 체크 — 클라이언트 IP 기반.
 * Supabase auth.signUp을 직접 호출하기 전에 우리 서버에서 일단 점검.
 * 같은 IP에서 무한 회원가입 시도 abuse 방지.
 *
 * 사용:
 *   POST /api/auth/signup-check → 200 OK 면 진행
 *   429 → 잠시 후
 */
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clientIp(req: Request): string {
  const h = req.headers
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: Request) {
  const ip = clientIp(req)
  // IP별 분당 3회, 시간당 10회
  if (!checkRateLimit(`signup:${ip}:m`, 3, 60_000)) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요' }, { status: 429 })
  }
  if (!checkRateLimit(`signup:${ip}:h`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: '시간당 10회 한도 초과' }, { status: 429 })
  }
  return NextResponse.json({ ok: true })
}
