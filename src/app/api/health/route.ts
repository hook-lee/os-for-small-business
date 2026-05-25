import { NextResponse } from 'next/server'
import { getCurrentUser, hasAuthConfig } from '@/lib/supabase/auth-server'

/**
 * 배포 진단 엔드포인트.
 *
 * 보안 정책:
 * - 비인증: 최소 정보 (auth 활성화 여부 + commit_sha만)
 * - 인증: 전체 진단 정보
 *
 * 키 값/prefix는 절대 노출 X.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function envStatus(name: string): string {
  const v = process.env[name]
  if (typeof v !== 'string' || v.length === 0) return '❌ NOT SET'
  return `✓ set (${v.length} chars)`
}

export async function GET() {
  const hasAuthVars = hasAuthConfig()
  const user = await getCurrentUser()

  // 비인증 시: 최소 정보만 (env 활성화 여부 + commit)
  if (!user) {
    return NextResponse.json({
      ok: true,
      auth_enabled: hasAuthVars,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      timestamp: new Date().toISOString(),
      hint: '상세 진단은 로그인 후 다시 호출',
    })
  }

  // 인증된 사용자 — 전체 진단
  return NextResponse.json({
    auth: {
      enabled: hasAuthVars,
      currentUser: user.email,
    },
    env: {
      GEMINI_API_KEY: envStatus('GEMINI_API_KEY'),
      SUPABASE_URL: envStatus('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: envStatus('SUPABASE_SERVICE_ROLE_KEY'),
      NEXT_PUBLIC_SUPABASE_URL: envStatus('NEXT_PUBLIC_SUPABASE_URL'),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: envStatus('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    },
    deploy: {
      vercel_env: process.env.VERCEL_ENV ?? 'local',
      vercel_region: process.env.VERCEL_REGION ?? 'none',
      commit_sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'none',
      commit_message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.slice(0, 100) ?? 'none',
    },
    runtime: {
      node: process.version,
      platform: process.platform,
    },
    timestamp: new Date().toISOString(),
  })
}
