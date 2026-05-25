import { fetchSessionById } from '@/lib/supabase/group-sessions'
import { fetchReservationsBySession } from '@/lib/supabase/group-reservations'
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

  const [session, reservations] = await Promise.all([
    fetchSessionById(id, ownerId),
    fetchReservationsBySession(id),
  ])
  if (!session) notFound()

  return <SessionRoster session={session} initialReservations={reservations} />
}
