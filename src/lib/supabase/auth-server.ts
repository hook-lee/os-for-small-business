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
import { getSupabaseClient } from './client'

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

export type StudioRole = 'owner' | 'admin' | 'instructor'

export interface StudioContext {
  ownerId: string              // 데이터 격리 기준 = 소속 스튜디오 소유자 id
  role: StudioRole             // owner/admin = 전체, instructor = 운영(회원·수업·일지)만
  instructorId: number | null  // 강사 계정으로 매핑된 경우 그 instructor.id
  userId: string | null
}

/**
 * 현재 로그인 사용자의 스튜디오 컨텍스트 판별 (강사 로그인 지원의 핵심).
 *  1) instructors.auth_user_id = 내 user.id 인 강사가 있으면 → 그 강사의 소속 스튜디오(owner_id) + role + instructorId
 *  2) 없으면 → 내 user.id 자체가 스튜디오 소유자(owner)
 * auth_user_id 컬럼이 아직 없거나(마이그 전) 조회 실패 시 owner로 graceful 폴백.
 */
export async function getStudioContext(): Promise<StudioContext> {
  if (!hasAuthConfig()) return { ownerId: 'no-auth', role: 'owner', instructorId: null, userId: null }
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized: 로그인이 필요합니다')
  try {
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from('instructors')
      .select('id, owner_id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (data) {
      const inst = data as { id: number; owner_id: string | null; role: string }
      const role: StudioRole = inst.role === 'owner' || inst.role === 'admin' ? inst.role : 'instructor'
      return { ownerId: inst.owner_id ?? user.id, role, instructorId: inst.id, userId: user.id }
    }
  } catch {
    // auth_user_id 미존재(마이그 전) 등 → owner 폴백
  }
  return { ownerId: user.id, role: 'owner', instructorId: null, userId: user.id }
}

/**
 * API route 가드: 로그인 안 됐으면 throw, 됐으면 ownerId 반환.
 * 강사 로그인이면 소속 스튜디오의 owner_id를 반환 → 기존 lib들은 동일하게 동작(데이터 격리 유지).
 * 사용:
 *   const ownerId = await requireOwnerId()
 *   const items = await fetchSomething(ownerId)
 */
export async function requireOwnerId(): Promise<string> {
  if (!hasAuthConfig()) {
    // 인증 미설정 환경 (로컬 개발) — fallback dummy id 반환
    return 'no-auth'
  }
  const ctx = await getStudioContext()
  return ctx.ownerId
}
