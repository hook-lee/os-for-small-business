'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseAuthBrowser } from '@/lib/supabase/auth-browser'
import type { StudioRole } from '@/lib/supabase/auth-server'
import { NotificationBell } from './NotificationBell'

interface NavItem { href: string; label: string; icon: string; match: string[] }
interface NavGroup { label: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  { label: '', items: [{ href: '/', label: '홈', icon: '🏠', match: ['/'] }] },
  {
    label: '운영',
    items: [
      { href: '/lessons', label: '수업', icon: '📅', match: ['/lessons'] },
      { href: '/members', label: '회원', icon: '👥', match: ['/members', '/pass-products', '/messages', '/consultations'] },
      { href: '/instructors', label: '강사', icon: '🧑‍🏫', match: ['/instructors'] },
    ],
  },
  {
    label: '재무·목표',
    items: [
      { href: '/finances', label: '재무', icon: '💰', match: ['/finances', '/add', '/sales', '/tax', '/analytics'] },
      { href: '/goals', label: '목표', icon: '🎯', match: ['/goals'] },
    ],
  },
  { label: '설정', items: [{ href: '/settings', label: '설정', icon: '⚙️', match: ['/settings'] }] },
]

// 강사(instructor)는 수업·회원만
const INSTRUCTOR_HREFS = new Set(['/lessons', '/members'])

export function Sidebar({
  userEmail, workspaceName, role = 'owner',
}: {
  userEmail: string | null
  workspaceName: string | null
  role?: StudioRole
}) {
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => { setCollapsed(localStorage.getItem('sb-collapsed') === '1') }, [])
  function toggle() {
    setCollapsed(c => { const n = !c; localStorage.setItem('sb-collapsed', n ? '1' : '0'); return n })
  }
  async function signOut() {
    setSigningOut(true)
    try { await getSupabaseAuthBrowser().auth.signOut() } catch { /* 무시 */ }
    router.push('/login'); router.refresh()
  }

  const isInstructor = role === 'instructor'
  function isActive(m: string[]) { return m.some(p => (p === '/' ? pathname === '/' : pathname.startsWith(p))) }

  return (
    <aside className={`hidden md:flex flex-col border-r border-neutral-200 bg-white sticky top-0 h-screen shrink-0 transition-[width] ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* 로고 + 알림 */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-neutral-100">
        <a href="/" className={`font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent truncate ${collapsed ? 'text-base' : 'text-lg'}`}>
          {collapsed ? 'O' : 'Onmove'}
        </a>
        {!collapsed && userEmail && <NotificationBell />}
      </div>
      {!collapsed && workspaceName && (
        <div className="px-3 py-1.5 text-xs text-neutral-400 truncate border-b border-neutral-50">{workspaceName}</div>
      )}

      {/* 메뉴 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((g, gi) => {
          const items = isInstructor ? g.items.filter(i => INSTRUCTOR_HREFS.has(i.href)) : g.items
          if (items.length === 0) return null
          return (
            <div key={gi} className="mb-1">
              {!collapsed && g.label && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{g.label}</div>
              )}
              {items.map(i => {
                const active = isActive(i.match)
                return (
                  <a
                    key={i.href}
                    href={i.href}
                    title={i.label}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 mx-2 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      active ? 'bg-violet-50 text-violet-700 font-medium' : 'text-neutral-600 hover:bg-neutral-100'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <span className="text-base shrink-0" aria-hidden>{i.icon}</span>
                    {!collapsed && <span className="truncate">{i.label}</span>}
                  </a>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* 하단: 접기 + 계정 */}
      <div className="border-t border-neutral-100 p-2 space-y-0.5">
        <button onClick={toggle} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-neutral-500 hover:bg-neutral-100" title={collapsed ? '펼치기' : '접기'}>
          <span className="text-base shrink-0" aria-hidden>{collapsed ? '»' : '«'}</span>
          {!collapsed && <span>접기</span>}
        </button>
        {userEmail && (
          <>
            {!collapsed && <div className="px-2.5 pt-1 text-[10px] text-neutral-400 truncate">{userEmail}</div>}
            <button onClick={signOut} disabled={signingOut} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50" title="로그아웃">
              <span className="text-base shrink-0" aria-hidden>🚪</span>
              {!collapsed && <span>{signingOut ? '로그아웃 중…' : '로그아웃'}</span>}
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
