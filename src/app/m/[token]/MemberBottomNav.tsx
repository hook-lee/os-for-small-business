'use client'

import { usePathname } from 'next/navigation'

export function MemberBottomNav({ token }: { token: string }) {
  const pathname = usePathname()
  const base = `/m/${token}`

  const items = [
    { href: base, label: '홈', icon: '🏠' },
    { href: `${base}/passes`, label: '수강권', icon: '🎟️' },
    { href: `${base}/lessons`, label: '일정', icon: '📅' },
    { href: `${base}/group`, label: '예약', icon: '✨' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-neutral-200">
      <div className="grid grid-cols-4">
        {items.map(item => {
          const active = pathname === item.href
          return (
            <a
              key={item.href}
              href={item.href}
              className={`py-3 text-center text-xs transition-colors ${
                active ? 'text-teal-600 font-semibold' : 'text-neutral-500'
              }`}
            >
              <div className="text-xl">{item.icon}</div>
              <div className="mt-0.5">{item.label}</div>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
