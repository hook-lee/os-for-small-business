import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/AppShell'
import { getCurrentUser } from '@/lib/supabase/auth-server'

export const metadata: Metadata = {
  title: '워크스페이스 — 라파 필라테스',
  description: '운영 대시보드',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <AppShell userEmail={user?.email ?? null}>{children}</AppShell>
      </body>
    </html>
  )
}
