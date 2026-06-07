import { requireOwnerId } from '@/lib/supabase/auth-server'
import { loadContractTemplates } from '@/lib/supabase/contracts'
import { loadProfile } from '@/lib/profile/settings'
import { SettingsTabs } from '../SettingsTabs'
import { ContractTemplatesEditor } from './ContractTemplatesEditor'

export const dynamic = 'force-dynamic'

export default async function ContractsSettingsPage() {
  await import('@/lib/supabase/guard').then(m => m.guardManagerPage())
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  const [templates, profile] = await Promise.all([
    loadContractTemplates(ownerId),
    loadProfile(ownerId).catch(() => null),
  ])

  return (
    <div className="space-y-4">
      <SettingsTabs current="contracts" />
      <div>
        <h2 className="text-xl font-semibold">계약서 템플릿</h2>
        <p className="text-sm text-neutral-500 mt-1">
          회원·강사에게 보낼 계약서 문구예요. 샘플 4종을 센터에 맞게 고치고 저장하세요.
          발송·동의 받기는 다음 단계에서 추가됩니다.
        </p>
      </div>
      <ContractTemplatesEditor initial={templates} workspaceName={profile?.workspaceName ?? null} />
    </div>
  )
}
