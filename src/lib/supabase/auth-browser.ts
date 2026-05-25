/**
 * 클라이언트 컴포넌트 (브라우저)에서 Supabase Auth 호출용.
 * - LoginForm의 signInWithPassword
 * - 로그아웃 버튼
 *
 * 일반 데이터 쿼리는 NEVER 여기서 — service_role 키가 클라이언트에 노출되면 안 됨.
 * 모든 데이터 조회는 /api/* 서버 라우트 통해서.
 */
import { createBrowserClient } from '@supabase/ssr'

let cached: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseAuthBrowser() {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수 필요')
  }
  cached = createBrowserClient(url, key)
  return cached
}
