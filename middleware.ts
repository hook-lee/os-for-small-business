/**
 * 인증 미들웨어 — Supabase Auth 기반.
 *
 * 흐름:
 * 1. 공개 경로(랜딩/로그인/회원 토큰/정적/일부 API)는 통과
 * 2. 그 외는 supabase session 확인
 *    - 있으면 통과
 *    - 없으면 /login으로 redirect
 *
 * 회원 토큰 페이지(/m/[token]/*)는 토큰 기반이라 인증 X
 * /api/health, /api/m/* 도 인증 X
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/login']
const PUBLIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/m/',                    // 회원 토큰 URL — 토큰 자체가 인증
  '/api/health',            // 진단
  '/api/auth/',             // 로그인/로그아웃 콜백
  '/api/m/',                // 회원 페이지가 호출하는 API
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 공개 경로
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Supabase Auth 미설정이면 통과 (로컬 개발 / 점진 도입용)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.next()
  }

  // 세션 검증 + 쿠키 갱신
  let response = NextResponse.next({ request: req })
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
        response = NextResponse.next({ request: req })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    // 비인증 → /login으로 redirect (원래 가려던 URL 보존)
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', pathname + req.nextUrl.search)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  // 모든 경로 매칭 (정적/이미지 제외는 위에서 처리)
  matcher: [
    /*
     * 매칭 제외:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico
     * 위는 위에서도 isPublicPath로 catch하지만, matcher에서 미리 거르면 더 빠름
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
