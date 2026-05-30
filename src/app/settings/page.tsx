import { loadProfile } from '@/lib/profile/settings'
import { SettingsForm } from './SettingsForm'
import { SettingsTabs } from './SettingsTabs'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  const profile = await loadProfile(ownerId)
  return (
    <div className="space-y-4">
      <SettingsTabs current="personal" />
      <h2 className="text-xl font-semibold">개인·세무 정보</h2>
      <p className="text-sm text-neutral-500">
        워크스페이스 정보. 세금 시뮬레이터 정확도에 사용됩니다.
      </p>
      <SettingsForm initial={profile} />
    </div>
  )
}
