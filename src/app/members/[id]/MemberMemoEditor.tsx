'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'

export function MemberMemoEditor({ memberId, initialInternalMemo }: { memberId: number; initialInternalMemo: string | null }) {
  const [memo, setMemo] = useState(initialInternalMemo ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalMemo: memo }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { alert(`저장 실패: ${json.error}`); return }
      setEditing(false)
    } catch { alert('네트워크 오류') }
    finally { setSaving(false) }
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">운영자 전용 메모 <span className="text-xs text-neutral-400 font-normal">(부상 이력·선호 시간 등)</span></h3>
        {editing ? (
          <div className="flex gap-1">
            <button onClick={save} disabled={saving} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => { setMemo(initialInternalMemo ?? ''); setEditing(false) }} className="text-xs text-neutral-500">취소</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600">수정</button>
        )}
      </div>
      {editing ? (
        <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
      ) : (
        <div className="text-sm text-neutral-600 whitespace-pre-wrap">{memo || <span className="text-neutral-400">메모 없음</span>}</div>
      )}
    </Card>
  )
}
