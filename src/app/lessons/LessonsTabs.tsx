import { Tabs } from '@/components/ui/Tabs'

export function LessonsTabs({ current }: { current: 'all' | 'individual' | 'groups' }) {
  // '개별 수업'은 전체 탭(개별/그룹 필터 내장)과 중복 → 상단 탭에서 제거.
  //  (개별 반복등록 등 deep 기능 페이지 /lessons/individual 자체는 유지)
  return (
    <Tabs
      current={current}
      items={[
        { href: '/lessons', label: '전체', key: 'all' },
        { href: '/lessons/groups', label: '그룹 수업 예약 관리', key: 'groups' },
      ]}
    />
  )
}
