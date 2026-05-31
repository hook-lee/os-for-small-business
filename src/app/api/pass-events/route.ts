import { NextResponse } from 'next/server'
import { fetchPassEventsByMember, fetchRecentPassEvents } from '@/lib/supabase/pass-events'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'

/**
 * GET /api/pass-events?memberId=N         → 회원별 이력
 * GET /api/pass-events?limit=N            → 최근 N건 전체
 */
export async function GET(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ events: [] })
  let ownerId: string
  try { ownerId = await requireOwnerId() }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const url = new URL(req.url)
  const memberIdStr = url.searchParams.get('memberId')
  const limitStr = url.searchParams.get('limit')
  const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 50, 500) : 50
  try {
    if (memberIdStr) {
      const memberId = parseInt(memberIdStr, 10)
      if (!Number.isFinite(memberId) || memberId <= 0) {
        return NextResponse.json({ error: '유효하지 않은 memberId' }, { status: 400 })
      }
      const events = await fetchPassEventsByMember(memberId, ownerId, limit)
      return NextResponse.json({ events })
    }
    const events = await fetchRecentPassEvents(ownerId, limit)
    return NextResponse.json({ events })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
