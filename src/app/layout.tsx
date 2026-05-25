import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/AppShell'
import { getCurrentUser } from '@/lib/supabase/auth-server'
import { loadProfile } from '@/lib/profile/settings'

export const metadata: Metadata = {
  title: 'Onmove — 운동 센터 사장님을 위한 워크스페이스',
  description: '회원·강사·매출·세금을 한 곳에서. AI 비서가 데이터 들고 상담합니다.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  // 로그인된 경우에만 workspace_name 조회
  let workspaceName: string | null = null
  if (user) {
    try {
      const profile = await loadProfile(user.id)
      workspaceName = profile.workspaceName
    } catch { /* graceful */ }
  }
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <AppShell userEmail={user?.email ?? null} workspaceName={workspaceName}>{children}</AppShell>
      </body>
    </html>
  )
}
