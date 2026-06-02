'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { MemberInstructorRate } from '@/lib/supabase/member-instructor-rates'

export interface RateInstructor {
  id: number
  name: string
  color: string | null
  ratePrivate: number
  rateRehab: number
  rateDuet: number
  rateGroup: number
}

interface Draft {
  customRate: string
  incentive: string
  memo: string
  saving: boolean
  saved: boolean
}

function initialDraft(rate: MemberInstructorRate | undefined): Draft {
  return {
    customRate: rate?.customRate != null ? String(rate.customRate) : '',
    incentive: String(rate?.incentivePerSession ?? 0),
    memo: rate?.memo ?? '',
    saving: false,
    saved: false,
  }
}

export function MemberInstructorRates({
  memberId,
  instructors,
  initialRates,
}: {
  memberId: number
  instructors: RateInstructor[]
  initialRates: MemberInstructorRate[]
}) {
  const router = useRouter()
  const rateMap = new Map(initialRates.map(r => [r.instructorId, r]))
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => {
    const map: Record<number, Draft> = {}
    for (const inst of instructors) map[inst.id] = initialDraft(rateMap.get(inst.id))
    return map
  })

  function update(instId: number, patch: Partial<Draft>) {
    setDrafts(prev => ({ ...prev, [instId]: { ...prev[instId], ...patch, saved: false } }))
  }

  async function save(inst: RateInstructor) {
    const d = drafts[inst.id]
    const customRate = d.customRate.trim() === '' ? null : parseInt(d.customRate, 10)
    if (customRate != null && (!Number.isFinite(customRate) || customRate < 0)) {
      alert('시급은 0 이상의 정수로 입력하세요')
      return
    }
    const incentive = parseInt(d.incentive, 10) || 0
    if (incentive < 0) { alert('인센티브는 0 이상'); return }
    update(inst.id, { saving: true })
    try {
      const res = await fetch('/api/member-instructor-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          instructorId: inst.id,
          customRate,
          incentivePerSession: incentive,
          memo: d.memo.trim() || null,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { alert(`저장 실패: ${json.error ?? 'unknown'}`); return }
      setDrafts(prev => ({ ...prev, [inst.id]: { ...prev[inst.id], saving: false, saved: true } }))
      router.refresh()
    } catch {
      alert('저장 실패: 네트워크 오류')
      update(inst.id, { saving: false })
    }
  }

  async function resetToDefault(inst: RateInstructor) {
    if (!confirm(`${inst.name} — 이 회원 전용 시급/인센티브를 지우고 강사 기본 시급으로 되돌릴까요?`)) return
    update(inst.id, { saving: true })
    try {
      const res = await fetch(`/api/member-instructor-rates?memberId=${memberId}&instructorId=${inst.id}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { alert(`삭제 실패: ${json.error ?? 'unknown'}`); return }
      setDrafts(prev => ({ ...prev, [inst.id]: { customRate: '', incentive: '0', memo: '', saving: false, saved: false } }))
      router.refresh()
    } catch {
      alert('삭제 실패: 네트워크 오류')
      update(inst.id, { saving: false })
    }
  }

  if (instructors.length === 0) return null

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">회원별 강사 시급 · 인센티브</h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          여기서 시급을 입력하면 월별 급여 정산에서 강사 기본 시급보다 <span className="font-medium text-neutral-700">우선 적용</span>됩니다.
          비워두면 강사 기본 시급을 그대로 사용해요.
        </p>
      </div>
      <div className="space-y-3">
        {instructors.map(inst => {
          const d = drafts[inst.id]
          const hasRate = rateMap.has(inst.id)
          return (
            <div key={inst.id} className="border border-neutral-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                {inst.color && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: inst.color }} />}
                <span className="text-sm font-medium">{inst.name}</span>
                {hasRate && <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">전용 시급 적용 중</span>}
              </div>
              <div className="text-xs text-neutral-400">
                강사 기본: 개인 {inst.ratePrivate.toLocaleString()} · 재활 {inst.rateRehab.toLocaleString()} · 듀엣 {inst.rateDuet.toLocaleString()} · 그룹 {inst.rateGroup.toLocaleString()}원
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-neutral-600">단일 시급 (원/회)
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={d.customRate}
                    onChange={e => update(inst.id, { customRate: e.target.value })}
                    placeholder="비우면 강사 기본"
                    className="block w-full mt-1 border rounded px-2 py-1 text-sm tabular-nums"
                  />
                </label>
                <label className="text-xs text-neutral-600">회당 인센티브 (원)
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={d.incentive}
                    onChange={e => update(inst.id, { incentive: e.target.value })}
                    className="block w-full mt-1 border rounded px-2 py-1 text-sm tabular-nums"
                  />
                </label>
              </div>
              <input
                type="text"
                value={d.memo}
                onChange={e => update(inst.id, { memo: e.target.value })}
                placeholder="사유 (예: 10회 재등록 보상)"
                className="block w-full border rounded px-2 py-1 text-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => save(inst)}
                  disabled={d.saving}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {d.saving ? '저장 중...' : '저장'}
                </button>
                {d.saved && <span className="text-xs text-emerald-600">저장됨 ✓</span>}
                {hasRate && (
                  <button
                    onClick={() => resetToDefault(inst)}
                    disabled={d.saving}
                    className="text-xs text-neutral-500 hover:text-red-600 ml-auto"
                  >
                    기본값으로 되돌리기
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
