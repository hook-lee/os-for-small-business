'use client'

import { usePathname } from 'next/navigation'
import { Nav } from './Nav'
import { FloatingAssistant } from './FloatingAssistant'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMember = pathname?.startsWith('/m/')

  if (isMember) {
    // Member pages: no admin chrome — mobile-first wrapper
    return <div className="min-h-screen bg-neutral-50">{children}</div>
  }

  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">워크스페이스 <span className="text-neutral-400 text-sm font-normal">· 라파 필라테스</span></h1>
          <Nav />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <FloatingAssistant />
    </>
  )
}
