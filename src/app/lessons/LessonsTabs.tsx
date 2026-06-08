import { Tabs } from '@/components/ui/Tabs'

export function LessonsTabs({ current }: { current: 'all' | 'individual' | 'groups' | 'products' }) {
  // '개별 수업'은 전체 탭(개별/그룹 필터 내장)과 중복 → 상단 탭에서 제거.
  //  수강권(상품)은 '회원'이 아니라 '수업' 묶음으로 이동.
  return (
    <Tabs
      current={current}
      items={[
        { href: '/lessons', label: '전체', key: 'all' },
        { href: '/lessons/groups', label: '그룹 수업 예약 관리', key: 'groups' },
        { href: '/pass-products', label: '수강권', key: 'products' },
      ]}
    />
  )
}
