/**
 * 공통 탭 — pill 스타일 (밑줄 탭 대신). 디자인 시스템 v1.
 * 가로 스크롤 가능(모바일). 활성 탭은 흰 배경 + 보라 텍스트.
 */
export interface TabItem {
  href: string
  label: string
  key: string
}

export function Tabs({ items, current }: { items: TabItem[]; current: string }) {
  return (
    <div className="mb-4 overflow-x-auto">
      <div className="inline-flex gap-1 bg-neutral-100 p-1 rounded-xl">
        {items.map(t => {
          const active = t.key === current
          return (
            <a
              key={t.key}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                active
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t.label}
            </a>
          )
        })}
      </div>
    </div>
  )
}
