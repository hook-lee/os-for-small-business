import { loadProfile } from '@/lib/profile/settings'
import { SettingsForm } from './SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const profile = await loadProfile()
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">설정</h2>
      <p className="text-sm text-neutral-500">
        라파 필라테스 운영자(유진) 개인 정보. 세금 시뮬레이터 정확도에 사용됩니다.
      </p>
      <SettingsForm initial={profile} />
    </div>
  )
}
