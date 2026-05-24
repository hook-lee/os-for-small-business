import { fetchMemberByToken } from '@/lib/supabase/members'
import { fetchUpcomingGroupSessions } from '@/lib/supabase/group-sessions'
import { fetchActivePassesByMember } from '@/lib/supabase/passes'
import { fetchReservationsByMember } from '@/lib/supabase/group-reservations'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import { MemberGroupBooking } from './MemberGroupBooking'

export const dynamic = 'force-dynamic'

export default async function MemberGroupPage({ params }: { params: Promise<{ token: string }> }) {
  if (!hasSupabaseConfig()) notFound()
  const { token } = await params
  const member = await fetchMemberByToken(token)
  if (!member) notFound()

  const [sessions, allActivePasses, myReservations] = await Promise.all([
    fetchUpcomingGroupSessions(),
    fetchActivePassesByMember(member.id),
    fetchReservationsByMember(member.id),
  ])

  const groupPasses = allActivePasses.filter(p => p.passType === '그룹')

  return (
    <MemberGroupBooking
      memberId={member.id}
      sessions={sessions}
      groupPasses={groupPasses}
      myReservations={myReservations}
    />
  )
}
