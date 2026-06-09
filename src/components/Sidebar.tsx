'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseAuthBrowser } from '@/lib/supabase/auth-browser'
import type { StudioRole } from '@/lib/supabase/auth-server'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { Icon, type IconName } from './ui/Icon'

interface SubItem { href: string; label: string }
interface NavItem { href: string; label: string; icon: IconName; match: string[]; children?: SubItem[] }
interface NavGroup { label: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  { label: '', items: [{ href: '/', label: '홈', icon: 'home', match: ['/'] }] },
  {
    label: '운영',
    items: [
      {
        href: '/lessons', label: '수업', icon: 'calendar', match: ['/lessons', '/pass-products'],
        children: [
          { href: '/lessons', label: '전체 일정' },
          { href: '/lessons/groups', label: '그룹 예약 관리' },
          { href: '/pass-products', label: '수강권 상품' },
        ],
      },
      {
        href: '/members', label: '회원', icon: 'users', match: ['/members', '/messages', '/consultations'],
        children: [
          { href: '/members', label: '회원 목록' },
          { href: '/consultations', label: '상담' },
          { href: '/messages', label: '메시지' },
        ],
      },
      {
        href: '/instructors', label: '강사', icon: 'instructor', match: ['/instructors'],
        children: [
          { href: '/instructors', label: '강사 목록' },
          { href: '/instructors?tab=scorecard', label: '강사 성과' },
          { href: '/instructors?tab=payroll', label: '월별 급여 정산' },
        ],
      },
    ],
  },
  {
    label: '재무·목표',
    items: [
      {
        href: '/finances', label: '재무', icon: 'wallet', match: ['/finances', '/add', '/sales', '/tax', '/analytics'],
        children: [
          { href: '/finances', label: '월별 요약' },
          { href: '/sales', label: '매출' },
          { href: '/add', label: '거래 입력' },
          { href: '/tax', label: '세금' },
          { href: '/analytics', label: '분석' },
        ],
      },
      { href: '/goals', label: '목표', icon: 'target', match: ['/goals'] },
    ],
  },
  {
    label: '설정',
    items: [
      {
        href: '/settings', label: '설정', icon: 'settings', match: ['/settings'],
        children: [
          { href: '/settings', label: '개인·세무' },
          { href: '/settings/operations', label: '운영정보' },
          { href: '/settings/contracts', label: '계약서' },
          { href: '/settings/import', label: '데이터 가져오기' },
        ],
      },
    ],
  },
]

// 강사(instructor)는 수업·회원만
const INSTRUCTOR_HREFS = new Set(['/lessons', '/members'])
// 부모와 href가 같은 첫 하위 항목은 하위경로에서 비활성(정확 매치만)
const PARENT_HREFS = new Set(['/lessons', '/members', '/finances', '/settings'])

export function Sidebar({
  userEmail, workspaceName, role = 'owner',
}: {
  userEmail: string | null
  workspaceName: string | null
  role?: StudioRole
}) {
  const pathname = usePathname() ?? '/'
  const searchParams = useSearchParams()
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
  function subActive(href: string) {
    const [path, qs] = href.split('?')
    const hrefTab = qs ? new URLSearchParams(qs).get('tab') : null
    const curTab = searchParams?.get('tab') ?? null
    if (path !== pathname) {
      if (PARENT_HREFS.has(path)) return false         // 첫 항목은 하위경로에서 비활성
      return pathname.startsWith(path + '/') || pathname.startsWith(path)
    }
    return hrefTab === curTab                           // 같은 경로면 tab 쿼리 일치로 판정
  }

  return (
    <aside className={`hidden md:flex flex-col border-r border-neutral-200 bg-white sticky top-0 h-screen shrink-0 transition-[width] ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex items-center justify-between px-3 h-14 border-b border-neutral-100">
        <a href="/" className={`font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent truncate ${collapsed ? 'text-base' : 'text-lg'}`}>
          {collapsed ? 'O' : 'Onmove'}
        </a>
        {!collapsed && userEmail && <NotificationBell panelAlign="left" />}
      </div>
      {!collapsed && workspaceName && (
        <div className="px-3 py-1.5 text-xs text-neutral-400 truncate border-b border-neutral-50">{workspaceName}</div>
      )}

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
                  <div key={i.href}>
                    <a
                      href={i.href}
                      title={i.label}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2.5 mx-2 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                        active ? 'bg-violet-50 text-violet-700 font-medium' : 'text-neutral-600 hover:bg-neutral-100'
                      } ${collapsed ? 'justify-center' : ''}`}
                    >
                      <Icon name={i.icon} size={18} className="shrink-0" />
                      {!collapsed && <span className="truncate">{i.label}</span>}
                    </a>
                    {/* 하위 메뉴 — 펼친 상태면 항상 노출 (활성 그룹은 강조) */}
                    {!collapsed && i.children && (
                      <div className="ml-7 mr-2 mb-1 border-l border-neutral-100 pl-2">
                        {i.children.map(s => (
                          <a
                            key={s.href}
                            href={s.href}
                            className={`block px-2 py-1 rounded text-[13px] transition-colors ${
                              subActive(s.href) ? 'text-violet-700 font-medium' : 'text-neutral-500 hover:text-neutral-800'
                            }`}
                          >
                            {s.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-neutral-100 p-2 space-y-0.5">
        <ThemeToggle collapsed={collapsed} />
        <button onClick={toggle} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-neutral-500 hover:bg-neutral-100" title={collapsed ? '펼치기' : '접기'}>
          <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={18} className="shrink-0" />
          {!collapsed && <span>접기</span>}
        </button>
        {userEmail && (
          <>
            {!collapsed && <div className="px-2.5 pt-1 text-[10px] text-neutral-400 truncate">{userEmail}</div>}
            <button onClick={signOut} disabled={signingOut} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-50" title="로그아웃">
              <Icon name="logout" size={18} className="shrink-0" />
              {!collapsed && <span>{signingOut ? '로그아웃 중…' : '로그아웃'}</span>}
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
