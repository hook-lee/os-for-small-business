'use client'

import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/members', label: '회원 목록' },
  { href: '/pass-products', label: '수강권' },
  { href: '/messages', label: '메시지' },
]

export function MembersTabBar() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 border-b border-neutral-200 mb-4">
      {TABS.map(t => {
        const active = t.href === '/members'
          ? (pathname === '/members' || pathname.startsWith('/members/'))
          : pathname === t.href || pathname.startsWith(t.href + '/')
        return (
          <a
            key={t.href}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              active ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.label}
          </a>
        )
      })}
    </div>
  )
}
