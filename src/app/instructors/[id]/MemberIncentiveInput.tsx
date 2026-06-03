'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 강사 상세 페이지에서 그 강사의 '회원별 회당 인센티브'를 바로 입력.
 * 기존 /api/member-instructor-rates(회원×강사) 재사용.
 * custom_rate·memo는 props로 받아 그대로 함께 전송 → 인센티브만 바꿔도 다른 설정이 안 지워짐.
 */
export function MemberIncentiveInput({ memberId, instructorId, initialIncentive, customRate, memo }: {
  memberId: number
  instructorId: number
  initialIncentive: number
  customRate: number | null
  memo: string | null
}) {
  const router = useRouter()
  const [value, setValue] = useState(initialIncentive ? String(initialIncentive) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const current = parseInt(value, 10) || 0
  const dirty = current !== (initialIncentive || 0)

  async function save() {
    if (current < 0) { alert('인센티브는 0 이상으로 입력하세요'); return }
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/member-instructor-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, instructorId, customRate, incentivePerSession: current, memo }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { alert(`저장 실패: ${json.error ?? 'unknown'}`); return }
      setSaved(true)
      router.refresh()
    } catch {
      alert('저장 실패: 네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false) }}
        placeholder="0"
        className="w-20 border border-neutral-300 rounded px-1.5 py-1 text-sm text-right tabular-nums"
      />
      <span className="text-xs text-neutral-400">원/회</span>
      {dirty ? (
        <button
          onClick={save}
          disabled={saving}
          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:bg-blue-300"
        >
          {saving ? '...' : '저장'}
        </button>
      ) : saved ? (
        <span className="text-xs text-emerald-600">✓</span>
      ) : null}
    </div>
  )
}
