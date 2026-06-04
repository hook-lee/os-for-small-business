'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseAuthBrowser } from '@/lib/supabase/auth-browser'

const TABS = [
  { href: '/', label: '홈', icon: '🏠', match: ['/'] },
  { href: '/lessons', label: '수업', icon: '📅', match: ['/lessons'] },
  { href: '/members', label: '회원', icon: '👥', match: ['/members', '/pass-products', '/messages', '/consultations'] },
  { href: '/finances', label: '재무', icon: '💰', match: ['/finances', '/add', '/sales', '/tax', '/analytics'] },
]

const MORE = [
  { href: '/instructors', label: '강사', icon: '🧑‍🏫', match: ['/instructors'] },
  { href: '/goals', label: '목표', icon: '🎯', match: ['/goals'] },
  { href: '/settings', label: '설정', icon: '⚙️', match: ['/settings'] },
]

function isActive(pathname: string, match: string[]): boolean {
  return match.some(p => (p === '/' ? pathname === '/' : pathname.startsWith(p)))
}

/**
 * 모바일 전용 하단 탭바 (앱 느낌). 데스크탑(md+)에선 숨김 — 상단 Nav가 담당.
 * 주메뉴 4개 + '더보기'(강사·목표·설정·계정·로그아웃) 바텀시트.
 */
export function MobileTabBar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const moreActive = MORE.some(m => isActive(pathname, m.match))

  async function signOut() {
    setSigningOut(true)
    try { await getSupabaseAuthBrowser().auth.signOut() } catch { /* 무시 */ }
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200 flex pb-[env(safe-area-inset-bottom)]">
        {TABS.map(t => {
          const active = isActive(pathname, t.match)
          return (
            <a
              key={t.href}
              href={t.href}
              className={`flex-1 flex flex-col items-center py-2 text-[10px] ${active ? 'text-blue-600 font-semibold' : 'text-neutral-500'}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-lg leading-none" aria-hidden>{t.icon}</span>
              <span className="mt-0.5">{t.label}</span>
            </a>
          )
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center py-2 text-[10px] ${moreActive || moreOpen ? 'text-blue-600 font-semibold' : 'text-neutral-500'}`}
        >
          <span className="text-lg leading-none" aria-hidden>☰</span>
          <span className="mt-0.5">더보기</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-1"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-3" />
            {MORE.map(m => {
              const active = isActive(pathname, m.match)
              return (
                <a
                  key={m.href}
                  href={m.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm ${active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-neutral-700 hover:bg-neutral-50'}`}
                >
                  <span className="text-lg" aria-hidden>{m.icon}</span>{m.label}
                </a>
              )
            })}
            {userEmail && (
              <div className="border-t border-neutral-100 mt-2 pt-2">
                <div className="px-3 py-1 text-xs text-neutral-400 truncate">{userEmail}</div>
                <button
                  type="button"
                  onClick={signOut}
                  disabled={signingOut}
                  className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <span className="text-lg" aria-hidden>🚪</span>{signingOut ? '로그아웃 중...' : '로그아웃'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
