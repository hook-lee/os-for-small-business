import { Tabs } from '@/components/ui/Tabs'

export function SettingsTabs({ current }: { current: 'personal' | 'operations' | 'contracts' }) {
  return (
    <Tabs
      current={current}
      items={[
        { href: '/settings', label: '개인·세무 정보', key: 'personal' },
        { href: '/settings/operations', label: '운영정보', key: 'operations' },
        { href: '/settings/contracts', label: '계약서', key: 'contracts' },
      ]}
    />
  )
}
