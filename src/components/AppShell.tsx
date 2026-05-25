'use client'

import { usePathname } from 'next/navigation'
import { Nav } from './Nav'
import { FloatingAssistant } from './FloatingAssistant'
import { UserMenu } from './UserMenu'

export function AppShell({
  children,
  userEmail,
  workspaceName,
}: {
  children: React.ReactNode
  userEmail: string | null
  workspaceName: string | null
}) {
  const pathname = usePathname()
  const isMember = pathname?.startsWith('/m/')
  const isLogin = pathname === '/login' || pathname === '/signup'

  // 로그인/회원가입 페이지: 헤더/푸터 X (자체 레이아웃)
  if (isLogin) {
    return <>{children}</>
  }

  if (isMember) {
    return <div className="min-h-screen bg-neutral-50">{children}</div>
  }

  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            <a href="/" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity" aria-label="홈으로">
              Onmove
            </a>
            {userEmail && workspaceName && (
              <span className="text-neutral-400 text-sm font-normal"> · {workspaceName}</span>
            )}
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
