'use client'

import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/add', label: '입력' },
  { href: '/sales', label: '매출' },
  { href: '/tax', label: '세금' },
  { href: '/analytics', label: '분석' },
  { href: '/finances/categories', label: '카테고리' },
]

export function FinancesTabBar() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 border-b border-neutral-200 mb-4">
      {TABS.map(t => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/')
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
