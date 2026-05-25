'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { MessageRecord } from '@/lib/supabase/messages'

interface PersonRef { id: number; name: string; phone: string | null }

type Group = '전체회원' | '만료임박' | '휴면' | '강사' | '사용자정의'

export function MessagesComposer({
  members, instructors, expiringIds, dormantIds, recent,
}: {
  members: PersonRef[]
  instructors: PersonRef[]
  expiringIds: number[]
  dormantIds: number[]
  recent: MessageRecord[]
}) {
  const router = useRouter()
  const [group, setGroup] = useState<Group>('전체회원')
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const recipients = useMemo<PersonRef[]>(() => {
    if (group === '전체회원') return members
    if (group === '만료임박') return members.filter(m => expiringIds.includes(m.id))
    if (group === '휴면') return members.filter(m => dormantIds.includes(m.id))
    if (group === '강사') return instructors
    return []
  }, [group, members, instructors, expiringIds, dormantIds])

  const phoneList = useMemo(() => recipients.filter(r => r.phone).map(r => r.phone!).join('\n'), [recipients])

  async function handleSave(status: 'draft' | 'sent') {
    if (!body.trim()) { setError('메시지 본문 필수'); return }
    if (recipients.length === 0) { setError('수신자가 없음'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientGroup: group,
          recipientIds: recipients.map(r => r.id),
          subject: subject || undefined,
          body,
          status,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? '저장 실패'); return }
      if (status === 'sent') alert('보냄 기록 저장됨. 전화번호 리스트 복사해서 외부 채널로 발송하세요.')
      setBody(''); setSubject('')
      router.refresh()
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">메시지 / 공지</h2>

      <Card className="text-xs text-neutral-600 bg-amber-50 border-amber-200">
        ⚠️ 현재는 <strong>UI + 기록 only</strong>. 외부 발송 API(SMS·카카오 알림톡·이메일) 미연동 — 작성 후 전화번호 리스트 복사해서 카톡/문자로 직접 보내세요. v3에서 알리고/SendGrid 연동 예정.
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-600">수신 그룹</label>
            <div className="flex flex-wrap gap-1">
              {(['전체회원', '만료임박', '휴면', '강사'] as Group[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  className={`text-sm px-3 py-1 rounded ${group === g ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                >
                  {g} {g === '만료임박' ? `(${expiringIds.length})` : g === '휴면' ? `(${dormantIds.length})` : g === '강사' ? `(${instructors.length})` : `(${members.length})`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-600">제목 (선택)</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="예: 5월 휴원 안내"
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-600">메시지 본문 *</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={6}
              placeholder="안녕하세요. 이번 주 수업 안내 드립니다 ..."
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm font-mono"
            />
            <div className="text-xs text-neutral-400 mt-1">{body.length}자</div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex gap-2">
            <button
              onClick={() => handleSave('sent')}
              disabled={saving}
              className="bg-blue-600 text-white px-3 py-2 rounded text-sm disabled:bg-blue-300"
            >
              {saving ? '저장 중...' : '보냄 기록'}
            </button>
            <button
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="bg-neutral-100 text-neutral-700 px-3 py-2 rounded text-sm hover:bg-neutral-200 disabled:opacity-50"
            >
              초안 저장
            </button>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold mb-2">수신자 {recipients.length}명</h3>
          {phoneList && (
            <div className="mb-3">
              <label className="block text-xs text-neutral-500 mb-1">전화번호 리스트 (복사용)</label>
              <textarea
                readOnly
                value={phoneList}
                rows={6}
                className="w-full border border-neutral-200 bg-neutral-50 rounded px-2 py-1 text-xs font-mono"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(phoneList); alert('복사됨') }}
                className="mt-1 text-xs text-blue-600 hover:underline"
              >
                전체 복사
              </button>
            </div>
          )}
          <div className="text-xs text-neutral-500 max-h-32 overflow-y-auto">
            {recipients.slice(0, 50).map(r => (
              <div key={r.id}>{r.name} {r.phone ? `· ${r.phone}` : '· 번호 없음'}</div>
            ))}
            {recipients.length > 50 && <div>... 외 {recipients.length - 50}명</div>}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-semibold mb-2">최근 메시지 기록</h3>
        {recent.length === 0 ? (
          <div className="text-xs text-neutral-400">기록 없음</div>
        ) : (
          <div className="space-y-2">
            {recent.map(r => (
              <div key={r.id} className="text-sm border-b border-neutral-100 pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.subject || '(제목 없음)'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${r.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                    {r.status === 'sent' ? '발송' : '초안'}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {r.recipientGroup} · {r.recipientCount}명 · {new Date(r.createdAt).toLocaleString('ko-KR')}
                </div>
                <div className="text-xs text-neutral-600 mt-1 line-clamp-2 whitespace-pre-wrap">{r.body}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
