'use client'

import { usePathname } from 'next/navigation'

const ITEMS: Array<{ href: string; label: string }> = [
  { href: '/', label: '홈' },
  { href: '/add', label: '입력' },
  { href: '/members', label: '회원' },
  { href: '/instructors', label: '강사' },
  { href: '/tax', label: '세금' },
  { href: '/analytics', label: '분석' },
  { href: '/settings', label: '설정' },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-4 text-sm">
      {ITEMS.map(({ href, label }) => {
        const active = pathname === href
        return (
          <a
            key={href}
            href={href}
            className={
              active
                ? 'text-blue-600 font-semibold'
                : 'text-neutral-600 hover:text-neutral-900 hover:underline'
            }
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </a>
        )
      })}
    </nav>
  )
}
