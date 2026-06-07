import { fetchMemberByToken } from '@/lib/supabase/members'
import { fetchContractsByMember } from '@/lib/supabase/contracts'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import { MemberContractsView } from './MemberContractsView'

export const dynamic = 'force-dynamic'

export default async function MemberContractsPage({ params }: { params: Promise<{ token: string }> }) {
  if (!hasSupabaseConfig()) notFound()
  const { token } = await params
  const member = await fetchMemberByToken(token)
  if (!member) notFound()
  const contracts = await fetchContractsByMember(member.id, member.ownerId ?? 'no-auth')
  return <MemberContractsView token={token} contracts={contracts} />
}
