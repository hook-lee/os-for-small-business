'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { NotificationSettings } from '@/lib/profile/settings'

interface Props {
  initial: {
    notificationSettings: NotificationSettings
    lowRemainingThreshold: number
    payrollDay: number | null
  }
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// 지급일 select 옵션: 미설정 / 1~30일 / 말일(31로 저장 → 그 달 실제 말일로 환산)
const PAYROLL_DAY_OPTIONS = [
  { value: '', label: '미설정' },
  ...Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}일` })),
  { value: '31', label: '말일' },
]

export function NotificationSettingsForm({ initial }: Props) {
  const router = useRouter()
  const [ns, setNs] = useState<NotificationSettings>(initial.notificationSettings)
  const [threshold, setThreshold] = useState<number>(initial.lowRemainingThreshold)
  const [payrollDay, setPayrollDay] = useState<number | null>(initial.payrollDay)
  const [state, setState] = useState<SaveState>('idle')

  const toggle = (key: keyof NotificationSettings) => setNs({ ...ns, [key]: !ns[key] })

  async function save() {
    setState('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationSettings: ns,
          lowRemainingThreshold: threshold,
          payrollDay,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      setState('saved')
      router.refresh()
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-neutral-700 mb-1">🔔 알림 설정</h3>
      <p className="text-xs text-neutral-400 mb-3">
        받고 싶은 알림만 켜세요. 상단 종(🔔)과 홈 &lsquo;처리 필요&rsquo;에 표시됩니다.
      </p>

      <div className="space-y-3">
        {/* 잔여 N회 이하 + 기준 */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ns.lowRemaining} onChange={() => toggle('lowRemaining')} />
            잔여
          </label>
          <input
            type="number"
            min="0"
            max="99"
            value={threshold}
            onChange={e => setThreshold(Math.min(99, Math.max(0, Math.floor(Number(e.target.value) || 0))))}
            className="border rounded px-2 py-1 w-16 text-right tabular-nums text-sm"
          />
          <span className="text-sm text-neutral-500">회 이하 회원 알림</span>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ns.expiring} onChange={() => toggle('expiring')} />
          만료 임박 (7일 내)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ns.dormant} onChange={() => toggle('dormant')} />
          휴면 회원 (60일+ 미출석)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ns.unpaidInstructors} onChange={() => toggle('unpaidInstructors')} />
          미정산 강사
        </label>

        {/* 강사 월급 D-day + 지급일 select (1~30 + 말일) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ns.payrollDday} onChange={() => toggle('payrollDday')} />
            강사 월급 D-1/D-day · 매월
          </label>
          <select
            value={payrollDay == null ? '' : String(payrollDay)}
            onChange={e => setPayrollDay(e.target.value === '' ? null : Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm bg-white"
          >
            {PAYROLL_DAY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-sm text-neutral-500">지급</span>
        </div>
        <p className="text-xs text-neutral-400 -mt-1">
          매월 마지막 날 지급이면 <b>말일</b>을 고르세요. 그 달이 30일·28일이어도 자동으로 마지막 날로 계산됩니다.
        </p>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={save}
          disabled={state === 'saving'}
          className="bg-neutral-900 text-white text-sm rounded px-4 py-2 disabled:opacity-50"
        >
          {state === 'saving' ? '저장 중…' : '알림 설정 저장'}
        </button>
        {state === 'saved' && <span className="text-sm text-green-600">저장됐어요 ✓</span>}
        {state === 'error' && <span className="text-sm text-red-600">저장 실패 — 다시 시도해주세요</span>}
      </div>
    </Card>
  )
}
