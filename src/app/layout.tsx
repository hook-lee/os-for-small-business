import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/AppShell'
import { getCurrentUser, type StudioRole } from '@/lib/supabase/auth-server'
import { getRoleSafe } from '@/lib/supabase/guard'
import { loadProfile } from '@/lib/profile/settings'

export const metadata: Metadata = {
  title: 'Onmove — 운동 센터 사장님을 위한 워크스페이스',
  description: '회원·강사·매출·세금을 한 곳에서. AI 비서가 데이터 들고 상담합니다.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  // 로그인된 경우에만 workspace_name 조회
  let workspaceName: string | null = null
  let role: StudioRole = 'owner'
  if (user) {
    try {
      const profile = await loadProfile(user.id)
      workspaceName = profile.workspaceName
    } catch { /* graceful */ }
    role = await getRoleSafe()
  }
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 다크 테마 깜빡임(FOUC) 방지 — 첫 페인트 전에 html.dark 적용 */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <AppShell userEmail={user?.email ?? null} workspaceName={workspaceName} role={role}>{children}</AppShell>
      </body>
    </html>
  )
}
