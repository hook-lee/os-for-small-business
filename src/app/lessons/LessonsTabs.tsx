export function LessonsTabs({ current }: { current: 'all' | 'individual' | 'groups' }) {
  const items: Array<{ href: string; label: string; key: 'all' | 'individual' | 'groups' }> = [
    { href: '/lessons', label: '전체', key: 'all' },
    { href: '/lessons/individual', label: '개별 수업', key: 'individual' },
    { href: '/lessons/groups', label: '그룹 수업', key: 'groups' },
  ]
  return (
    <div className="flex gap-1 border-b border-neutral-200 mb-4">
      {items.map(t => (
        <a
          key={t.key}
          href={t.href}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
