export function SettingsTabs({ current }: { current: 'personal' | 'operations' | 'contracts' }) {
  const items: Array<{ href: string; label: string; key: 'personal' | 'operations' | 'contracts' }> = [
    { href: '/settings', label: '개인·세무 정보', key: 'personal' },
    { href: '/settings/operations', label: '운영정보', key: 'operations' },
    { href: '/settings/contracts', label: '계약서', key: 'contracts' },
  ]
  return (
    <div className="flex gap-1 border-b border-neutral-200 mb-4 overflow-x-auto">
      {items.map(t => (
        <a
          key={t.key}
          href={t.href}
          className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            current === t.key
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          {t.label}
        </a>
      ))}
    </div>
  )
}
