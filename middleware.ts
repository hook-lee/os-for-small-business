/**
 * 인증 미들웨어 + 보안 헤더.
 *
 * 인증 흐름:
 * 1. 공개 경로(랜딩/로그인/회원 토큰/정적/일부 API)는 통과
 * 2. 그 외는 supabase session 확인 → 없으면 /login으로 redirect
 *
 * 보안 헤더 (모든 응답에 적용):
 * - X-Frame-Options: DENY (clickjacking 방지)
 * - X-Content-Type-Options: nosniff (MIME sniffing 차단)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: 카메라/마이크 등 비활성
 * - Strict-Transport-Security (HSTS): HTTPS 강제
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/login', '/signup']
const PUBLIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/m/',                    // 회원 토큰 URL
  '/api/health',
  '/api/auth/',
  '/api/m/',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  // CSP — Gemini SDK + Supabase + Google Fonts 허용
  // unsafe-inline은 Tailwind 인라인 스타일 + Next.js 인라인 스크립트 위해 필요
  res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '))
  return res
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 공개 경로
  if (isPublicPath(pathname)) {
    return applySecurityHeaders(NextResponse.next())
  }

  // Supabase Auth 미설정이면 통과 (로컬 개발 / 점진 도입용)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return applySecurityHeaders(NextResponse.next())
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
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', pathname + req.nextUrl.search)
    return applySecurityHeaders(NextResponse.redirect(redirectUrl))
  }

  return applySecurityHeaders(response)
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
