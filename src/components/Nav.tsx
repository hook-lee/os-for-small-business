'use client'

import { usePathname } from 'next/navigation'

const ITEMS: Array<{ href: string; label: string; matchPrefixes?: string[]; accent?: boolean }> = [
  { href: '/', label: '홈', matchPrefixes: ['/'] },
  { href: '/lessons', label: '수업', matchPrefixes: ['/lessons'] },
  { href: '/members', label: '회원', matchPrefixes: ['/members', '/pass-products', '/messages'] },
  { href: '/instructors', label: '강사', matchPrefixes: ['/instructors'] },
  { href: '/finances', label: '재무', matchPrefixes: ['/finances', '/add', '/sales', '/tax', '/analytics', '/finances/categories'] },
  { href: '/assistant', label: '💬 AI 비서', matchPrefixes: ['/assistant'], accent: true },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-4 text-sm">
      {ITEMS.map(({ href, label, matchPrefixes, accent }) => {
        const active = matchPrefixes
          ? matchPrefixes.some(p => p === '/' ? pathname === '/' : pathname.startsWith(p))
          : pathname === href
        const base = accent
          ? (active
              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold px-3 py-1 rounded-full'
              : 'bg-gradient-to-r from-violet-50 to-fuchsia-50 text-violet-700 font-semibold px-3 py-1 rounded-full border border-violet-200 hover:from-violet-100 hover:to-fuchsia-100')
          : (active
              ? 'text-blue-600 font-semibold'
              : 'text-neutral-600 hover:text-neutral-900 hover:underline')
        return (
          <a key={href} href={href} className={base} aria-current={active ? 'page' : undefined}>
            {label}
          </a>
        )
      })}
      <a
        href="/settings"
        aria-label="설정"
        className={
          (typeof pathname === 'string' && pathname.startsWith('/settings'))
            ? 'text-blue-600'
            : 'text-neutral-500 hover:text-neutral-800'
        }
        title="설정"
      >
        ⚙️
      </a>
    </nav>
  )
}
