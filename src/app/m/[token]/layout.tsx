import { fetchMemberByToken } from '@/lib/supabase/members'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import { MemberBottomNav } from './MemberBottomNav'
import { MemberHeader } from './MemberHeader'

export default async function MemberLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ token: string }>
}) {
  if (!hasSupabaseConfig()) notFound()
  const { token } = await params
  const member = await fetchMemberByToken(token)
  if (!member) notFound()

  return (
    <div className="max-w-md mx-auto min-h-screen bg-neutral-50 pb-20">
      <MemberHeader memberName={member.name} />
      <div className="px-4 py-4">{children}</div>
      <MemberBottomNav token={token} />
    </div>
  )
}
