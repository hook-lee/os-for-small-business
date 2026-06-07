'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { toast } from '@/components/ui/toast'

export function SuspendPolicyForm({ initial }: { initial: number }) {
  const router = useRouter()
  const [days, setDays] = useState<number>(initial)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSuspendDays: days }),
      })
      if (!res.ok) throw new Error()
      toast('정지 정책 저장됐어요', 'success')
      router.refresh()
    } catch {
      toast('저장 실패', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-neutral-700 mb-1">⏸ 수강권 정지 정책</h3>
      <p className="text-xs text-neutral-400 mb-3">
        회원이 수강권을 일시정지할 수 있는 <b>누적 최대 일수</b>예요. 정지하면 그만큼 만료일이 자동으로 늘어나고,
        누적이 이 일수를 넘으면 더는 정지할 수 없어요. <b>0</b>으로 두면 무제한.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          max="365"
          value={days}
          onChange={e => setDays(Math.max(0, Math.min(365, Math.floor(Number(e.target.value) || 0))))}
          className="border border-neutral-300 rounded px-2 py-1.5 w-24 text-right tabular-nums text-sm"
        />
        <span className="text-sm text-neutral-500">일 (회원당 누적)</span>
        <button
          onClick={save}
          disabled={saving}
          className="ml-auto bg-neutral-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </Card>
  )
}
