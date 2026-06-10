import { fetchSessionById } from '@/lib/supabase/group-sessions'
import { fetchReservationsBySession } from '@/lib/supabase/group-reservations'
import { fetchAllPasses } from '@/lib/supabase/passes'
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

  const [session, reservations, passes, members] = await Promise.all([
    fetchSessionById(id, ownerId),
    fetchReservationsBySession(id),
    fetchAllPasses(ownerId),
    fetchAllMembers(ownerId),
  ])
  if (!session) notFound()

  // 예약 후보 = 이 수업 종류의 수강권(이용중)을 가진 회원만.
  // 예: '그룹' 세션이면 이름에 '그룹'이 든 수강권 보유자. (아무 회원이나 예약되는 것 방지)
  const cat = session.category || '그룹'
  const eligibleMemberIds = new Set(
    passes
      .filter(p => p.status === '이용중' && p.memberId != null && (p.passName ?? '').includes(cat))
      .map(p => p.memberId as number),
  )
  const eligibleMembers = members
    .filter(m => eligibleMemberIds.has(m.id))
    .map(m => ({ id: m.id, name: m.name, phone: m.phone ?? null }))

  return <SessionRoster session={session} initialReservations={reservations} eligibleMembers={eligibleMembers} />
}
