import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PREFIXES = ['/_next', '/favicon.ico']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const password = process.env.WORKSPACE_PASSWORD
  if (!password) return NextResponse.next()  // 비번 미설정 시 통과 (로컬 개발)

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Workspace"' },
    })
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString()
  const [, providedPw] = decoded.split(':')
  if (providedPw !== password) {
    return new NextResponse('Wrong password', { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/health).*)'],
}
