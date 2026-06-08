'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { MobileTabBar } from './MobileTabBar'
import { NotificationBell } from './NotificationBell'
import { FloatingAssistant } from './FloatingAssistant'
import { ToastContainer } from './ui/toast'
import type { StudioRole } from '@/lib/supabase/auth-server'

export function AppShell({
  children,
  userEmail,
  workspaceName,
  role = 'owner',
}: {
  children: React.ReactNode
  userEmail: string | null
  workspaceName: string | null
  role?: StudioRole
}) {
  const pathname = usePathname()
  const isMember = pathname?.startsWith('/m/')
  const isLogin = pathname === '/login' || pathname === '/signup'

  // 로그인/회원가입 페이지: 헤더/사이드바 X (자체 레이아웃)
  if (isLogin) {
    return <>{children}</>
  }

  // 회원 토큰 페이지: 자체 레이아웃
  if (isMember) {
    return <div className="min-h-screen bg-neutral-50">{children}<ToastContainer /></div>
  }

  return (
    <div className="md:flex bg-neutral-50 min-h-screen">
      {/* 데스크탑: 좌측 세로 사이드바 */}
      <Sidebar userEmail={userEmail} workspaceName={workspaceName} role={role} />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* 모바일: 상단 얇은 헤더 (사이드바는 모바일에서 숨김 → 하단 탭바가 담당) */}
        <header className="md:hidden border-b border-neutral-200 bg-white sticky top-0 z-30">
          <div className="px-4 h-14 flex items-center justify-between">
            <a href="/" className="text-lg font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent" aria-label="홈으로">
              Onmove
              {workspaceName && <span className="text-neutral-400 text-xs font-normal"> · {workspaceName}</span>}
            </a>
            {userEmail && <NotificationBell />}
          </div>
        </header>

        <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6 pb-24 md:pb-8">{children}</main>
      </div>

      {userEmail && <FloatingAssistant />}
      {userEmail && <MobileTabBar userEmail={userEmail} role={role} />}
      <ToastContainer />
    </div>
  )
}
