import { fetchMemberByToken } from '@/lib/supabase/members'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { loadProfile } from '@/lib/profile/settings'
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

  // 회원의 owner의 workspace_name을 헤더에 표시
  const ownerProfile = await loadProfile(member.ownerId ?? 'no-auth')

  return (
    <div className="max-w-md mx-auto min-h-screen bg-neutral-50 pb-20">
      <MemberHeader memberName={member.name} workspaceName={ownerProfile.workspaceName} />
      <div className="px-4 py-4">{children}</div>
      <MemberBottomNav token={token} />
    </div>
  )
}
