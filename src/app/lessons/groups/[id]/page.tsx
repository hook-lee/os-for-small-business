import { fetchSessionById } from '@/lib/supabase/group-sessions'
import { fetchReservationsBySession } from '@/lib/supabase/group-reservations'
import { fetchAllPasses } from '@/lib/supabase/passes'
import { fetchAllPassProducts } from '@/lib/supabase/pass-products'
import { fetchAllMembers } from '@/lib/supabase/members'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import { SessionRoster } from './SessionRoster'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) notFound()
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id) || id <= 0) notFound()
  const ownerId = await requireOwnerId().catch(() => 'no-auth')

  const [session, reservations, passes, products, members] = await Promise.all([
    fetchSessionById(id, ownerId),
    fetchReservationsBySession(id, ownerId),
    fetchAllPasses(ownerId),
    fetchAllPassProducts(ownerId),
    fetchAllMembers(ownerId),
  ])
  if (!session) notFound()

  // 예약 후보 = 이 수업 종류(카테고리)의 수강권을 가진 '이용중' 회원만. (아무 회원이나 예약되는 것 방지)
  // §0: 수강권 이름에 카테고리 단어가 들었는지 추측하지 않고, 원장이 상품에 지정한 pass_products.category로 매칭.
  //      수강권명(스냅샷)으로 상품을 찾아 그 상품의 카테고리와 세션 카테고리를 비교한다.
  //      상품 매칭이 안 되거나 카테고리가 아직 미설정인 수강권은 막지 않는다(미설정 센터에서 예약 불가 방지).
  const cat = session.category || '그룹'
  const categoryByProductName = new Map<string, string | null>()
  for (const pr of products) categoryByProductName.set(pr.name.trim(), pr.category)
  const eligibleMemberIds = new Set(
    passes
      .filter(p => {
        if (p.status !== '이용중' || p.memberId == null) return false
        const pc = categoryByProductName.get((p.passName ?? '').trim())
        if (pc == null) return true   // 상품 매칭 안 됨/카테고리 미설정 → 후보에서 막지 않음
        return pc === cat             // 설정돼 있으면 세션 카테고리와 정확 매칭
      })
      .map(p => p.memberId as number),
  )
  const eligibleMembers = members
    .filter(m => eligibleMemberIds.has(m.id))
    .map(m => ({ id: m.id, name: m.name, phone: m.phone ?? null }))

  return <SessionRoster session={session} initialReservations={reservations} eligibleMembers={eligibleMembers} />
}
