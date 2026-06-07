'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/ui/toast'
import {
  currentSuspension, totalSuspendDays, remainingSuspendDays, inclusiveDays, type Suspension,
} from '@/lib/analytics/suspensions'

function fmt(d: string): string {
  const [, m, day] = d.split('-').map(Number)
  return `${m}/${day}`
}

export function PassSuspensionControl({
  passId, initial, maxSuspendDays, today,
}: {
  passId: number
  initial: Suspension[]
  maxSuspendDays: number
  today: string
}) {
  const router = useRouter()
  const [suspensions, setSuspensions] = useState<Suspension[]>(initial)
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const active = currentSuspension(suspensions, today)
  const used = totalSuspendDays(suspensions)
  const remain = remainingSuspendDays(suspensions, maxSuspendDays)
  const previewDays = inclusiveDays(start, end)

  async function add() {
    if (previewDays <= 0) { toast('종료일이 시작일보다 빨라요', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/passes/${passId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end, reason: reason.trim() || null }),
      })
      const json = await res.json() as { ok?: boolean; id?: number; days?: number; error?: string }
      if (!res.ok || !json.id) { toast(`정지 실패: ${json.error ?? 'unknown'}`, 'error'); return }
      setSuspensions(prev => [
        { id: json.id!, passId, startDate: start, endDate: end, days: json.days ?? previewDays, reason: reason.trim() || null, createdAt: today },
        ...prev,
      ])
      setOpen(false); setReason('')
      toast(`정지 등록됨 — 만료일이 ${json.days ?? previewDays}일 연장됐어요`, 'success')
      router.refresh()
    } catch {
      toast('정지 실패: 네트워크 오류', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number, days: number) {
    if (!confirm(`이 정지 기록을 삭제할까요?\n만료일이 ${days}일 줄어듭니다.`)) return
    const prev = suspensions
    setSuspensions(suspensions.filter(s => s.id !== id))
    try {
      const res = await fetch(`/api/passes/${passId}/suspend?suspensionId=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setSuspensions(prev)
      toast('삭제 실패', 'error')
    }
  }

  return (
    <div className="border-t border-neutral-100 pt-1.5 mt-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {active ? (
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-medium">
              ⏸ 정지중 · {fmt(active.startDate)}~{fmt(active.endDate)} ({active.days}일)
            </span>
          ) : (
            <span className="text-neutral-400">정지 없음</span>
          )}
          {used > 0 && (
            <span className="text-neutral-400">
              누적 {used}일{maxSuspendDays > 0 ? ` / 최대 ${maxSuspendDays}일` : ' (무제한)'}
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          disabled={remain <= 0}
          className="text-xs text-orange-700 hover:text-orange-900 border border-orange-200 rounded px-2 py-1 hover:bg-orange-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title={remain <= 0 ? '최대 정지일수를 모두 사용했어요' : '수강권 일시정지'}
        >
          {open ? '닫기' : '⏸ 정지'}
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2 bg-orange-50/40 border border-orange-100 rounded-lg p-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1 text-[11px] text-neutral-500">시작일
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="block w-full mt-0.5 border border-neutral-300 rounded px-2 py-1 text-sm" />
            </label>
            <label className="flex-1 text-[11px] text-neutral-500">종료일
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="block w-full mt-0.5 border border-neutral-300 rounded px-2 py-1 text-sm" />
            </label>
          </div>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="사유 (선택 · 예: 여행, 부상)"
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-500">
              {previewDays > 0
                ? <>정지 <b className="text-orange-700">{previewDays}일</b> → 만료일 {previewDays}일 연장{Number.isFinite(remain) ? ` (남은 정지 가능 ${remain}일)` : ''}</>
                : '종료일을 시작일 이후로'}
            </span>
            <button onClick={add} disabled={busy || previewDays <= 0}
              className="text-sm bg-orange-600 text-white rounded px-3 py-1 disabled:opacity-50 shrink-0">
              {busy ? '처리 중…' : '정지 등록'}
            </button>
          </div>
        </div>
      )}

      {suspensions.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {suspensions.map(s => (
            <li key={s.id} className="flex items-center justify-between text-[11px] text-neutral-500">
              <span>
                {fmt(s.startDate)}~{fmt(s.endDate)} · {s.days}일{s.reason ? ` · ${s.reason}` : ''}
              </span>
              <button onClick={() => remove(s.id, s.days)} className="text-neutral-300 hover:text-red-500 px-1" title="삭제">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
