/**
 * Server-side Supabase client (auth용).
 *
 * 일반 데이터 조회는 src/lib/supabase/client.ts (service_role)을 그대로 사용.
 * 이 파일은 *로그인된 사용자 식별* 전용 (anon key + 쿠키).
 *
 * 사용처:
 * - middleware.ts (요청별 세션 확인 + 쿠키 갱신)
 * - server components/route handlers에서 getSession() 호출 시
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { CookieOptions } from '@supabase/ssr'

function getEnvUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_URL 환경변수 필요')
  return url
}

function getEnvAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수 필요 (Supabase 대시보드 → Settings → API → anon public key)')
  return key
}

export function hasAuthConfig(): boolean {
  return !!(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)
  )
}

/**
 * Server components / route handlers에서 사용.
 * cookies()는 dynamic이므로 호출하는 페이지도 dynamic 처리됨.
 */
export async function getSupabaseAuthServer() {
  const cookieStore = await cookies()
  return createServerClient(
    getEnvUrl(),
    getEnvAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component에서 set() 호출 불가 — middleware가 처리하므로 무시 가능
          }
        },
      },
    },
  )
}

/**
 * 현재 로그인된 사용자 반환. 비로그인이면 null.
 */
export async function getCurrentUser() {
  if (!hasAuthConfig()) return null
  try {
    const supabase = await getSupabaseAuthServer()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    return data.user
  } catch {
    return null
  }
}

/**
 * 현재 owner_id (= auth.users.id). 비로그인 시 null.
 *
 * SaaS multi-tenant 핵심:
 * - API route에서 호출 → 모든 supabase lib 함수에 ownerId로 전달
 * - 각 lib 함수는 .eq('owner_id', ownerId) 필터 적용
 * - ownerId 누락 시 fallback: hasAuthConfig() false면 전체 조회 (로컬 개발 모드)
 */
export async function getCurrentOwnerId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}

/**
 * API route 가드: 로그인 안 됐으면 throw, 됐으면 ownerId 반환.
 * 사용:
 *   const ownerId = await requireOwnerId()
 *   const items = await fetchSomething(ownerId)
 */
export async function requireOwnerId(): Promise<string> {
  if (!hasAuthConfig()) {
    // 인증 미설정 환경 (로컬 개발) — fallback dummy id 반환
    // 실제 쿼리에서 .eq('owner_id', 'no-auth') → 0개 결과
    // 또는 lib 함수가 ownerId가 'no-auth'면 필터 생략하도록 처리 가능
    return 'no-auth'
  }
  const id = await getCurrentOwnerId()
  if (!id) throw new Error('Unauthorized: 로그인이 필요합니다')
  return id
}
