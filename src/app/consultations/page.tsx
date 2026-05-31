import { fetchAllConsultations } from '@/lib/supabase/consultations'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'
import { MembersTabBar } from '@/components/MembersTabBar'
import { ConsultationsManager } from './ConsultationsManager'

export const dynamic = 'force-dynamic'

export default async function ConsultationsPage() {
  const ownerId = await requireOwnerId().catch(() => 'no-auth')

  let consultations: Awaited<ReturnType<typeof fetchAllConsultations>> = []
  let instructors: Awaited<ReturnType<typeof fetchAllInstructors>> = []
  if (hasSupabaseConfig()) {
    try {
      [consultations, instructors] = await Promise.all([
        fetchAllConsultations(ownerId),
        fetchAllInstructors(ownerId),
      ])
    } catch { /* 보여주기만 — 에러는 client side가 처리 */ }
  }

  return (
    <>
      <MembersTabBar />
      <ConsultationsManager
        initialConsultations={consultations}
        instructors={instructors.map(i => ({ id: i.id, name: i.name }))}
      />
    </>
  )
}
