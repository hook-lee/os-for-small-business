'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { Instructor } from '@/lib/supabase/instructors'
import type { PayrollRecord } from '@/lib/supabase/payroll'
import { computePayrollTotal } from '@/lib/analytics/payroll'

interface EditState {
  privateCount: string
  rehabCount: string
  duetCount: string
  groupCount: string
  bonus: string
  deduction: string
  memo: string
  paid: boolean
}

function recordToEdit(r: PayrollRecord | null): EditState {
  return {
    privateCount: String(r?.privateCount ?? 0),
    rehabCount: String(r?.rehabCount ?? 0),
    duetCount: String(r?.duetCount ?? 0),
    groupCount: String(r?.groupCount ?? 0),
    bonus: String(r?.bonus ?? 0),
    deduction: String(r?.deduction ?? 0),
    memo: r?.memo ?? '',
    paid: r?.paid ?? false,
  }
}

export function PayrollTable({ initialMonth, instructors, initialRecords }: {
  initialMonth: string
  instructors: Instructor[]
  initialRecords: PayrollRecord[]
}) {
  const router = useRouter()
  const [yearMonth, setYearMonth] = useState(initialMonth)

  // 각 강사별 편집 상태 (instructor_id → EditState)
  const [edits, setEdits] = useState<Record<number, EditState>>(() => {
    const map: Record<number, EditState> = {}
    for (const inst of instructors) {
      const rec = initialRecords.find(r => r.instructorId === inst.id) ?? null
      map[inst.id] = recordToEdit(rec)
    }
    return map
  })
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [error, setError] = useState('')

  function updateEdit(instId: number, patch: Partial<EditState>) {
    setEdits(prev => ({ ...prev, [instId]: { ...prev[instId], ...patch } }))
  }

  function calc(inst: Instructor, edit: EditState) {
    const breakdown = computePayrollTotal(inst, {
      privateCount: parseInt(edit.privateCount, 10) || 0,
      rehabCount: parseInt(edit.rehabCount, 10) || 0,
      duetCount: parseInt(edit.duetCount, 10) || 0,
      groupCount: parseInt(edit.groupCount, 10) || 0,
    })
    const bonus = parseInt(edit.bonus, 10) || 0
    const deduction = parseInt(edit.deduction, 10) || 0
    const net = breakdown.grossTotal + bonus - deduction
    return { ...breakdown, bonus, deduction, net }
  }

  async function handleSave(inst: Instructor) {
    const edit = edits[inst.id]
    const result = calc(inst, edit)
    setSaving(prev => ({ ...prev, [inst.id]: true }))
    setError('')
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId: inst.id,
          yearMonth,
          privateCount: parseInt(edit.privateCount, 10) || 0,
          rehabCount: parseInt(edit.rehabCount, 10) || 0,
          duetCount: parseInt(edit.duetCount, 10) || 0,
          groupCount: parseInt(edit.groupCount, 10) || 0,
          totalAmount: result.grossTotal,
          bonus: result.bonus,
          deduction: result.deduction,
          memo: edit.memo || null,
          paid: edit.paid,
          paidAt: edit.paid ? new Date().toISOString().slice(0, 10) : null,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setError(`${inst.name} 저장 실패: ${json.error ?? 'unknown'}`)
        return
      }
    } catch {
      setError(`${inst.name} 저장 실패: 네트워크 오류`)
    } finally {
      setSaving(prev => ({ ...prev, [inst.id]: false }))
    }
  }

  async function changeMonth(newYm: string) {
    setYearMonth(newYm)
    router.push(`/payroll?ym=${newYm}`)
  }

  const totals = useMemo(() => {
    let gross = 0, bonus = 0, deduction = 0, net = 0
    for (const inst of instructors) {
      const c = calc(inst, edits[inst.id])
      gross += c.grossTotal
      bonus += c.bonus
      deduction += c.deduction
      net += c.net
    }
    return { gross, bonus, deduction, net }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructors, edits])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">강사 급여 정산</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600">정산월</label>
          <input
            type="month"
            value={yearMonth}
            onChange={e => changeMonth(e.target.value)}
            className="border border-neutral-300 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="총 급여 (gross)" value={`${totals.gross.toLocaleString()}원`} />
        <Stat label="보너스 합계" value={`${totals.bonus.toLocaleString()}원`} />
        <Stat label="공제 합계" value={`-${totals.deduction.toLocaleString()}원`} />
        <Stat label="실 지급 (net)" value={`${totals.net.toLocaleString()}원`} highlight />
      </div>

      <div className="text-xs text-neutral-500 bg-blue-50 border border-blue-200 px-3 py-2 rounded">
        수업 횟수는 수동 입력. v2.2 일정 모듈 완성 후 자동 집계 예정. 각 행 별로 &quot;저장&quot; 눌러야 반영됨.
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {instructors.map(inst => {
        const edit = edits[inst.id]
        const result = calc(inst, edit)
        const isSaving = saving[inst.id] ?? false
        return (
          <Card key={inst.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {inst.color && <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: inst.color }} />}
                <span className="font-semibold">{inst.name}</span>
                <span className="text-xs text-neutral-500">
                  {inst.role === 'owner' ? '오너' : inst.role === 'admin' ? '관리자' : '강사'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={edit.paid}
                    onChange={e => updateEdit(inst.id, { paid: e.target.checked })}
                  />
                  지급 완료
                </label>
                <button
                  onClick={() => handleSave(inst)}
                  disabled={isSaving}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <CountInput
                label={`개인 (${inst.ratePrivate.toLocaleString()}/회)`}
                value={edit.privateCount}
                onChange={v => updateEdit(inst.id, { privateCount: v })}
                subtotal={result.privateTotal}
              />
              <CountInput
                label={`재활 (${inst.rateRehab.toLocaleString()}/회)`}
                value={edit.rehabCount}
                onChange={v => updateEdit(inst.id, { rehabCount: v })}
                subtotal={result.rehabTotal}
              />
              <CountInput
                label={`듀엣 (${inst.rateDuet.toLocaleString()}/회)`}
                value={edit.duetCount}
                onChange={v => updateEdit(inst.id, { duetCount: v })}
                subtotal={result.duetTotal}
              />
              <CountInput
                label={`그룹 (${inst.rateGroup.toLocaleString()}/회)`}
                value={edit.groupCount}
                onChange={v => updateEdit(inst.id, { groupCount: v })}
                subtotal={result.groupTotal}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <NumberInput label="총 급여 (gross)" value={result.grossTotal} readOnly />
              <NumberInput
                label="보너스 (+)"
                value={result.bonus}
                onChange={v => updateEdit(inst.id, { bonus: String(v) })}
              />
              <NumberInput
                label="공제 (-)"
                value={result.deduction}
                onChange={v => updateEdit(inst.id, { deduction: String(v) })}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <input
                type="text"
                value={edit.memo}
                onChange={e => updateEdit(inst.id, { memo: e.target.value })}
                placeholder="메모 (선택)"
                className="flex-1 mr-3 border border-neutral-300 rounded px-2 py-1 text-sm"
              />
              <div className="text-right">
                <div className="text-xs text-neutral-500">실 지급</div>
                <div className="text-lg font-bold tabular-nums text-blue-600">{result.net.toLocaleString()}원</div>
              </div>
            </div>
          </Card>
        )
      })}
      {instructors.length === 0 && (
        <Card>
          <div className="text-sm text-neutral-400">강사 데이터가 없습니다.</div>
        </Card>
      )}
    </div>
  )
}

function CountInput({ label, value, onChange, subtotal }: { label: string; value: string; onChange: (v: string) => void; subtotal: number }) {
  return (
    <div>
      <label className="block text-xs text-neutral-600 mb-1">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-neutral-300 rounded px-2 py-1 text-sm tabular-nums"
      />
      <div className="text-xs text-neutral-400 mt-0.5 tabular-nums">{subtotal.toLocaleString()}원</div>
    </div>
  )
}

function NumberInput({ label, value, onChange, readOnly }: { label: string; value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-neutral-600 mb-1">{label}</label>
      {readOnly ? (
        <div className="w-full border border-neutral-200 bg-neutral-50 rounded px-2 py-1 text-sm tabular-nums">
          {value.toLocaleString()}원
        </div>
      ) : (
        <input
          type="number"
          min="0"
          value={value || ''}
          onChange={e => onChange?.(parseInt(e.target.value, 10) || 0)}
          className="w-full border border-neutral-300 rounded px-2 py-1 text-sm tabular-nums"
        />
      )}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${highlight ? 'text-blue-600' : ''}`}>{value}</div>
    </Card>
  )
}
