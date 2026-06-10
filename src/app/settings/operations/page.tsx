import { requireOwnerId } from '@/lib/supabase/auth-server'
import { loadStudioSettings } from '@/lib/supabase/studio-settings'
import { loadProfile } from '@/lib/profile/settings'
import { SettingsTabs } from '../SettingsTabs'
import { OperationsForm } from './OperationsForm'
import { RoomsManager } from './RoomsManager'
import { NotificationSettingsForm } from './NotificationSettingsForm'
import { SuspendPolicyForm } from './SuspendPolicyForm'

export const dynamic = 'force-dynamic'

export default async function OperationsSettingsPage() {
  await import('@/lib/supabase/guard').then(m => m.guardManagerPage())
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  const [initial, profile] = await Promise.all([
    loadStudioSettings(ownerId),
    loadProfile(ownerId),
  ])

  return (
    <div className="space-y-4">
      <SettingsTabs current="operations" />
      <div>
        <h2 className="text-xl font-semibold">운영정보 설정</h2>
        <p className="text-sm text-neutral-500 mt-1">
          예약·취소 가능 시간, 폐강 시간, 일별 예약 횟수 등 스튜디오 운영 규칙을 설정합니다.
          모든 설정은 저장 후 즉시 적용됩니다.
        </p>
      </div>
      <OperationsForm initial={initial} />
      <RoomsManager />
      <SuspendPolicyForm initial={profile.maxSuspendDays} />
      <NotificationSettingsForm
        initial={{
          notificationSettings: profile.notificationSettings,
          lowRemainingThreshold: profile.lowRemainingThreshold,
          payrollDay: profile.payrollDay,
        }}
      />
    </div>
  )
}
