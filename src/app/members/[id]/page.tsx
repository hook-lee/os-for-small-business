import { fetchMemberById } from '@/lib/supabase/members'
import { fetchPassesByMember } from '@/lib/supabase/passes'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { notFound } from 'next/navigation'
import { IssuePassForm } from './IssuePassForm'
import { PassesList } from './PassesList'

export const dynamic = 'force-dynamic'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) notFound()
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id)) notFound()
  const [m, passes] = await Promise.all([
    fetchMemberById(id),
    fetchPassesByMember(id),
  ])
  if (!m) notFound()

  return (
    <div className="space-y-4 max-w-2xl">
      <a href="/members" className="text-sm text-neutral-500 hover:underline">← 회원 목록</a>
      <h2 className="text-2xl font-semibold">{m.name}</h2>
      <Card className="space-y-2">
        <Row label="전화번호" value={m.phone} />
        <Row label="이메일" value={m.email} />
        <Row label="성별" value={m.gender} />
        <Row label="생년월일" value={m.birthDate} />
        <Row label="주소" value={[m.address, m.detailAddress].filter(Boolean).join(' ') || null} />
        <Row label="회원등급" value={m.tier} />
        <Row label="등록일" value={m.registeredAt} />
        <Row label="최근 출석" value={m.lastAttendedAt} />
        <Row label="앱 연결" value={m.appConnected ? '연결' : '미연결'} />
        {m.memo && <Row label="메모" value={m.memo} />}
      </Card>

      <div>
        <div className="flex items-center justify-between mt-6 mb-2">
          <h3 className="text-lg font-semibold">수강권 이력 ({passes.length}건)</h3>
          <IssuePassForm memberId={m.id} />
        </div>
        <PassesList initial={passes} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex">
      <div className="w-24 shrink-0 text-sm text-neutral-500">{label}</div>
      <div className="text-sm">{value ?? '—'}</div>
    </div>
  )
}
