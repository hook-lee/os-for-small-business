import { NextResponse } from 'next/server'

/**
 * 배포 환경 진단 엔드포인트.
 *
 * 안전성:
 * - 키 값 자체는 절대 노출 안 함. 존재 여부(set/NOT SET)와 길이만 표시.
 * - 키 prefix/suffix도 노출 X.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function envStatus(name: string): string {
  const v = process.env[name]
  if (typeof v !== 'string' || v.length === 0) return '❌ NOT SET'
  return `✓ set (${v.length} chars)`
}

export async function GET() {
  return NextResponse.json({
    env: {
      GEMINI_API_KEY: envStatus('GEMINI_API_KEY'),
      SUPABASE_URL: envStatus('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: envStatus('SUPABASE_SERVICE_ROLE_KEY'),
      NEXT_PUBLIC_SUPABASE_URL: envStatus('NEXT_PUBLIC_SUPABASE_URL'),
    },
    deploy: {
      vercel_env: process.env.VERCEL_ENV ?? 'local',
      vercel_url: process.env.VERCEL_URL ?? 'none',
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
