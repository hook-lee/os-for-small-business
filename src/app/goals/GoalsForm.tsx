'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { AnnualGoal } from '@/lib/profile/settings'

/** 저장값(원·0~1) → 폼 입력값(만원·%) 변환. null/0 → '' */
function toInput(v: number | null, kind: 'man' | 'count' | 'rate'): string {
  if (v == null || v === 0) return ''
  if (kind === 'man') return String(Math.round(v / 10_000))
  if (kind === 'rate') return String(Math.round(v * 100))
  return String(Math.round(v))
}

/** 폼 입력값 → 저장값. 빈 문자열 → null */
function fromInput(s: string, kind: 'man' | 'count' | 'rate'): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  if (kind === 'man') return Math.round(n) * 10_000
  if (kind === 'rate') return Math.min(n / 100, 1)
  return Math.floor(n)
}

export function GoalsForm({
  year,
  initialGoal,
  allGoals,
}: {
  year: number
  initialGoal: AnnualGoal | null
  allGoals: Record<string, AnnualGoal>
}) {
  const router = useRouter()
  const g = initialGoal
  const [revenue, setRevenue] = useState(toInput(g?.revenue ?? null, 'man'))
  const [netProfit, setNetProfit] = useState(toInput(g?.netProfit ?? null, 'man'))
  const [activeMembers, setActiveMembers] = useState(toInput(g?.activeMembers ?? null, 'count'))
  const [newMembers, setNewMembers] = useState(toInput(g?.newMembers ?? null, 'count'))
  const [trialRate, setTrialRate] = useState(toInput(g?.trialConversionRate ?? null, 'rate'))
  const [reregRate, setReregRate] = useState(toInput(g?.reregistrationRate ?? null, 'rate'))

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMsg('')
    const goal: AnnualGoal = {
      revenue: fromInput(revenue, 'man'),
      netProfit: fromInput(netProfit, 'man'),
      activeMembers: fromInput(activeMembers, 'count'),
      newMembers: fromInput(newMembers, 'count'),
      trialConversionRate: fromInput(trialRate, 'rate'),
      reregistrationRate: fromInput(reregRate, 'rate'),
    }
    const annualGoals = { ...allGoals, [String(year)]: goal }
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annualGoals }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = (body && typeof body === 'object' && 'error' in body) ? String(body.error) : `HTTP ${res.status}`
        throw new Error(msg)
      }
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '알 수 없는 오류')
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-3">
        <Field label="연 매출 목표" unit="만원" value={revenue} onChange={setRevenue} placeholder="예: 12000" />
        <Field label="순이익 목표" unit="만원" value={netProfit} onChange={setNetProfit} placeholder="예: 4000" />
        <Field label="활성 회원 목표" unit="명" value={activeMembers} onChange={setActiveMembers} placeholder="예: 80" />
        <Field label="신규 회원 목표" unit="명/연" value={newMembers} onChange={setNewMembers} placeholder="예: 60" />
        <Field label="체험→등록 전환율 목표" unit="%" value={trialRate} onChange={setTrialRate} placeholder="예: 50" />
        <Field label="재등록률 목표" unit="%" value={reregRate} onChange={setReregRate} placeholder="예: 70" />
      </div>

      <p className="text-xs text-neutral-500">
        비워두면 해당 지표는 &lsquo;목표 미설정&rsquo;으로 표시됩니다. 매출·순이익은 <b>만원</b> 단위로 입력하세요 (예: 12000 = 1억 2천만원).
      </p>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
        >
          {status === 'saving' ? '저장 중...' : status === 'saved' ? '저장됨 ✓' : `${year}년 목표 저장`}
        </button>
        {status === 'error' && <span className="text-red-600 text-sm">저장 실패: {errorMsg}</span>}
      </div>
    </form>
  )
}

function Field({
  label, unit, value, onChange, placeholder,
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <span className="text-xs text-neutral-400 whitespace-nowrap">{unit}</span>
      </div>
    </div>
  )
}
