'use client'

import { usePathname } from 'next/navigation'
import { Nav } from './Nav'
import { FloatingAssistant } from './FloatingAssistant'
import { UserMenu } from './UserMenu'

export function AppShell({ children, userEmail }: { children: React.ReactNode; userEmail: string | null }) {
  const pathname = usePathname()
  const isMember = pathname?.startsWith('/m/')
  const isLogin = pathname === '/login'

  // 로그인 페이지: 헤더/푸터 X (자체 레이아웃)
  if (isLogin) {
    return <>{children}</>
  }

  if (isMember) {
    // 회원 페이지 — 토큰 URL, 별도 chrome 없음
    return <div className="min-h-screen bg-neutral-50">{children}</div>
  }

  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            워크스페이스 <span className="text-neutral-400 text-sm font-normal">· 라파 필라테스</span>
          </h1>
          <div className="flex items-center gap-4">
            <Nav />
            <UserMenu email={userEmail} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      {userEmail && <FloatingAssistant />}
    </>
  )
}
