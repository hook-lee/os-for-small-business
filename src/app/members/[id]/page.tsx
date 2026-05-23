import { fetchMemberById } from '@/lib/supabase/members'
import { fetchPassesByMember } from '@/lib/supabase/passes'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { notFound } from 'next/navigation'

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

      <h3 className="text-lg font-semibold mt-6">수강권 이력 ({passes.length}건)</h3>
      <div className="space-y-2">
        {passes.map(p => (
          <Card key={p.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="font-medium">{p.passName} <span className="text-xs text-neutral-400">{p.passType ?? ''}</span></div>
              <span className={`text-xs px-2 py-0.5 rounded ${p.status === '이용중' ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                {p.status ?? '—'}
              </span>
            </div>
            <div className="text-sm text-neutral-600">
              {p.startDate ?? '—'} ~ {p.endDate ?? '—'} · {p.remainingCount ?? '—'}/{p.totalCount ?? '—'}회 잔여
            </div>
            <div className="text-xs text-neutral-500">
              {p.paymentType ?? '—'} · {p.paymentAmount?.toLocaleString() ?? '—'}원 · {p.paymentMethod ?? '—'} · {p.paidAt ?? '—'}
            </div>
          </Card>
        ))}
        {passes.length === 0 && <div className="text-sm text-neutral-400">수강권 이력 없음</div>}
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
