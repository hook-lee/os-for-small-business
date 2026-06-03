'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { AnnualGoal } from '@/lib/profile/settings'

type Kind = 'money' | 'count' | 'rate'

/** 저장값(원·개수·0~1) → 폼 입력 표시값. money는 천단위 콤마, rate는 %. null/0 → '' */
function toInput(v: number | null, kind: Kind): string {
  if (v == null || v === 0) return ''
  if (kind === 'money') return Math.round(v).toLocaleString()
  if (kind === 'rate') return String(Math.round(v * 100))
  return String(Math.round(v))
}

/** 폼 입력값 → 저장값(원·개수·0~1). 빈 문자열 → null. money/count는 콤마 제거 후 파싱 */
function fromInput(s: string, kind: Kind): number | null {
  const t = s.replace(/,/g, '').trim()
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  if (kind === 'rate') return Math.min(n / 100, 1)
  return Math.floor(n)   // money·count 모두 원/개수 그대로
}

/** 입력 중 천단위 콤마 자동 삽입 (숫자만 남기고 toLocaleString) */
function formatThousands(s: string): string {
  const digits = s.replace(/[^\d]/g, '')
  if (digits === '') return ''
  return Number(digits).toLocaleString()
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
  const [revenue, setRevenue] = useState(toInput(g?.revenue ?? null, 'money'))
  const [netProfit, setNetProfit] = useState(toInput(g?.netProfit ?? null, 'money'))
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
      revenue: fromInput(revenue, 'money'),
      netProfit: fromInput(netProfit, 'money'),
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
        <Field label="연 매출 목표" unit="원" value={revenue} onChange={v => setRevenue(formatThousands(v))} placeholder="예: 104,000,000" />
        <Field label="순이익 목표" unit="원" value={netProfit} onChange={v => setNetProfit(formatThousands(v))} placeholder="예: 40,000,000" />
        <Field label="활성 회원 목표" unit="명" value={activeMembers} onChange={v => setActiveMembers(formatThousands(v))} placeholder="예: 80" />
        <Field label="신규 회원 목표" unit="명/연" value={newMembers} onChange={v => setNewMembers(formatThousands(v))} placeholder="예: 60" />
        <Field label="체험→등록 전환율 목표" unit="%" value={trialRate} onChange={setTrialRate} numeric placeholder="예: 50" />
        <Field label="재등록률 목표" unit="%" value={reregRate} onChange={setReregRate} numeric placeholder="예: 70" />
      </div>

      <p className="text-xs text-neutral-500">
        비워두면 해당 지표는 &lsquo;목표 미설정&rsquo;으로 표시됩니다. 매출·순이익은 <b>원 단위</b>로 입력하세요 — 천 단위 콤마는 자동으로 들어갑니다 (예: 1억 = 100,000,000).
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
  label, unit, value, onChange, placeholder, numeric,
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** true면 type=number (rate 등 작은 값). 기본은 text + 콤마 표시 */
  numeric?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type={numeric ? 'number' : 'text'}
          inputMode="numeric"
          min={numeric ? '0' : undefined}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm w-full text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <span className="text-xs text-neutral-400 whitespace-nowrap">{unit}</span>
      </div>
    </div>
  )
}
