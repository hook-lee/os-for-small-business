export function LessonsTabs({ current }: { current: 'all' | 'individual' | 'groups' }) {
  // '개별 수업'은 전체 탭(개별/그룹 필터 내장)과 중복 → 상단 탭에서 제거.
  //  (개별 반복등록 등 deep 기능 페이지 /lessons/individual 자체는 유지)
  const items: Array<{ href: string; label: string; key: 'all' | 'individual' | 'groups' }> = [
    { href: '/lessons', label: '전체', key: 'all' },
    { href: '/lessons/groups', label: '그룹 수업 예약 관리', key: 'groups' },
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
