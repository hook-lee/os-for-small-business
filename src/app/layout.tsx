import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'

export const metadata: Metadata = {
  title: '워크스페이스 — 라파 필라테스',
  description: '운영 대시보드 (세금·매출·지출)',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold">워크스페이스 <span className="text-neutral-400 text-sm font-normal">· 라파 필라테스</span></h1>
            <Nav />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
