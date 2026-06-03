import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { fetchPassesByMember } from '@/lib/supabase/passes'
import { evaluatePassGuard } from '@/lib/analytics/member-status'
import { requireOwnerId } from '@/lib/supabase/auth-server'

/**
 * 수업 추가 가드: 이 회원이 지금 수업 잡아도 되는 수강권 상태인지.
 * 전체 수강권을 조회해 잔여 0회·기간 만료까지 판정 (active만 보는 /passes와 달리 endDate도 검사).
 * 미설정/조회 실패 시 usable=true로 폴백(가드가 정상 흐름을 막지 않도록 — 어디까지나 경고용).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ usable: true, status: 'active', reason: '' })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id)) return NextResponse.json({ usable: true, status: 'active', reason: '' })
  try {
    const today = new Date().toISOString().slice(0, 10)
    const passes = await fetchPassesByMember(id, ownerId)
    return NextResponse.json(evaluatePassGuard(passes, today))
  } catch {
    // 조회 실패는 가드 미적용(통과)으로 — 경고 기능이 수업 추가 자체를 막으면 안 됨
    return NextResponse.json({ usable: true, status: 'active', reason: '' })
  }
}
