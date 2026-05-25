import { NextResponse } from 'next/server'
import { getSupabaseAuthServer, hasAuthConfig } from '@/lib/supabase/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!hasAuthConfig()) {
    return NextResponse.json({ ok: true })
  }
  try {
    const supabase = await getSupabaseAuthServer()
    await supabase.auth.signOut()
  } catch {
    // 무시 — 어차피 쿠키는 클라이언트에서도 지움
  }
  const url = new URL('/login', req.url)
  return NextResponse.redirect(url, { status: 303 })
}
