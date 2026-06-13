'use client'
import { toast } from '@/components/ui/toast'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { Instructor } from '@/lib/supabase/instructors'
import type { PayrollRecord } from '@/lib/supabase/payroll'
import {
  computeCategoryPayroll,
  instructorRateForCategory,
  effectiveRateMap,
  computeTaxWithholding,
  type MemberPayrollLine,
  type CategoryCounts,
} from '@/lib/analytics/payroll'

interface EditState {
  counts: Record<string, string>  // 카테고리 → 횟수(문자열)
  adjustment: string              // 회원별 시급·인센티브 조정액 (자동 집계로 채워짐)
  bonus: string
  deduction: string
  memo: string
  paid: boolean
}

function recordToEdit(r: PayrollRecord | null): EditState {
  const counts: Record<string, string> = {}
  if (r) {
    const cc = r.categoryCounts ?? {}
    if (Object.keys(cc).length > 0) {
      for (const [k, v] of Object.entries(cc)) counts[k] = String(v)
    } else {
      // 레거시 4종 카운트 → 카테고리 맵 (v3.24 전 저장분)
      if (r.privateCount) counts['개인'] = String(r.privateCount)
      if (r.rehabCount) counts['재활'] = String(r.rehabCount)
      if (r.duetCount) counts['듀엣'] = String(r.duetCount)
      if (r.groupCount) counts['그룹'] = String(r.groupCount)
    }
  }
  return {
    counts,
    adjustment: String(r?.adjustment ?? 0),
    bonus: String(r?.bonus ?? 0),
    deduction: String(r?.deduction ?? 0),
    memo: r?.memo ?? '',
    paid: r?.paid ?? false,
  }
}

const emptyEdit = (): EditState => ({ counts: {}, adjustment: '0', bonus: '0', deduction: '0', memo: '', paid: false })

/** 강사 카드에 보여줄 카테고리 행 목록 = 센터 카테고리 ∪ 강사 시급 카테고리 ∪ 입력된 횟수 카테고리. */
function rowCategories(inst: Instructor, edit: EditState, center: string[]): string[] {
  const set = new Set<string>()
  for (const c of center) set.add(c)
  for (const k of Object.keys(effectiveRateMap(inst))) set.add(k)
  for (const k of Object.keys(edit.counts)) set.add(k)
  return Array.from(set)
}

function parseCounts(counts: Record<string, string>): CategoryCounts {
  const out: CategoryCounts = {}
  for (const [k, v] of Object.entries(counts)) {
    const n = parseInt(v, 10)
    if (Number.isFinite(n) && n > 0) out[k] = n
  }
  return out
}

/** 레거시 4 컬럼 back-compat 매핑 (개인/재활/듀엣/그룹만 채움). */
function legacyCols(counts: CategoryCounts) {
  return {
    privateCount: counts['개인'] ?? 0,
    rehabCount: counts['재활'] ?? 0,
    duetCount: counts['듀엣'] ?? 0,
    groupCount: counts['그룹'] ?? 0,
  }
}

export function PayrollTable({ initialMonth, instructors, initialRecords, basePath = '/payroll', categories = ['개인', '재활', '듀엣', '그룹'] }: {
  initialMonth: string
  instructors: Instructor[]
  initialRecords: PayrollRecord[]
  basePath?: string
  categories?: string[]
}) {
  const router = useRouter()
  const [yearMonth, setYearMonth] = useState(initialMonth)

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
  const [autoLines, setAutoLines] = useState<Record<number, MemberPayrollLine[]>>({})

  function updateEdit(instId: number, patch: Partial<EditState>) {
    setEdits(prev => ({ ...prev, [instId]: { ...prev[instId], ...patch } }))
  }
  function setCount(instId: number, cat: string, v: string) {
    setEdits(prev => ({ ...prev, [instId]: { ...prev[instId], counts: { ...prev[instId].counts, [cat]: v } } }))
  }

  function calc(inst: Instructor, edit: EditState) {
    const counts = parseCounts(edit.counts)
    const { byCategory, grossTotal: naiveGross } = computeCategoryPayroll(inst, counts)
    const adjustment = parseInt(edit.adjustment, 10) || 0
    const grossTotal = naiveGross + adjustment
    const taxWithholding = computeTaxWithholding(grossTotal)
    const bonus = parseInt(edit.bonus, 10) || 0
    const deduction = parseInt(edit.deduction, 10) || 0
    const net = grossTotal + bonus - taxWithholding - deduction
    return { byCategory, counts, naiveGross, adjustment, grossTotal, taxWithholding, bonus, deduction, net }
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
          categoryCounts: result.counts,
          ...legacyCols(result.counts), // 레거시 4 컬럼 back-compat
          adjustment: result.adjustment,
          totalAmount: result.grossTotal,
          bonus: result.bonus,
          deduction: result.deduction,
          taxWithholding: result.taxWithholding,
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

  function changeMonth(newYm: string) {
    setYearMonth(newYm)
    const params = basePath === '/instructors' ? `?tab=payroll&ym=${newYm}` : `?ym=${newYm}`
    router.push(`${basePath}${params}`)
  }

  function resetInstructor(instId: number) {
    setEdits(prev => ({ ...prev, [instId]: emptyEdit() }))
    setAutoLines(prev => ({ ...prev, [instId]: [] }))
  }

  function resetAll() {
    if (!confirm('모든 강사 입력을 초기화할까요? (저장되지 않은 변경사항만 초기화 — DB에 저장된 데이터는 그대로)')) return
    setEdits(() => {
      const map: Record<number, EditState> = {}
      for (const inst of instructors) map[inst.id] = emptyEdit()
      return map
    })
    setAutoLines({})
  }

  async function applyAutoCounts(instructorId: number, silent: boolean = false, mode: 'full' | 'todate' = 'full') {
    if (!silent) {
      const current = edits[instructorId]
      const hasManual = Object.values(current.counts).some(v => (parseInt(v, 10) || 0) > 0)
      if (hasManual && !confirm('현재 입력된 횟수가 자동 집계 값으로 덮어쓰여집니다. 계속할까요?')) return
    }
    try {
      const res = await fetch(`/api/payroll/auto?instructorId=${instructorId}&yearMonth=${yearMonth}&mode=${mode}`)
      const json = await res.json() as {
        categoryCounts?: Record<string, number> | null
        adjustment?: number
        lines?: MemberPayrollLine[]
        error?: string
      }
      if (!res.ok || !json.categoryCounts) {
        if (!silent) toast(`자동 집계 실패: ${json.error ?? 'unknown'}`)
        return
      }
      const counts: Record<string, string> = {}
      for (const [k, v] of Object.entries(json.categoryCounts)) counts[k] = String(v)
      setEdits(prev => ({
        ...prev,
        [instructorId]: { ...prev[instructorId], counts, adjustment: String(json.adjustment ?? 0) },
      }))
      setAutoLines(prev => ({ ...prev, [instructorId]: json.lines ?? [] }))
    } catch {
      if (!silent) toast('네트워크 오류')
    }
  }

  async function applyAutoAll(mode: 'full' | 'todate' = 'full') {
    const label = mode === 'todate' ? '현 시점까지' : '전체(예약 포함)'
    if (!confirm(`모든 강사의 횟수를 [${label}] 자동 집계로 덮어쓸까요? (저장 안 한 변경사항은 사라집니다)`)) return
    for (const inst of instructors) {
      await applyAutoCounts(inst.id, true, mode)
    }
  }

  const totals = useMemo(() => {
    let gross = 0, tax = 0, bonus = 0, deduction = 0, net = 0
    for (const inst of instructors) {
      const c = calc(inst, edits[inst.id])
      gross += c.grossTotal
      tax += c.taxWithholding
      bonus += c.bonus
      deduction += c.deduction
      net += c.net
    }
    return { gross, tax, bonus, deduction, net }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructors, edits])

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h2 className="text-lg md:text-xl font-semibold shrink-0">강사 급여 정산</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-neutral-600">정산월</label>
          <input
            type="month"
            value={yearMonth}
            onChange={e => changeMonth(e.target.value)}
            className="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <button
            onClick={() => applyAutoAll('full')}
            title="그 달에 예약된 모든 수업 기준 (완료 표시 안 해도 포함)"
            className="whitespace-nowrap text-sm bg-blue-50 text-blue-700 border border-blue-200 px-3 min-h-[38px] rounded-lg hover:bg-blue-100"
          >
            ✨ 전체 집계
          </button>
          <button
            onClick={() => applyAutoAll('todate')}
            title="오늘까지 진행된 수업만 기준"
            className="whitespace-nowrap text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 min-h-[38px] rounded-lg hover:bg-emerald-100"
          >
            📅 현 시점
          </button>
          <button
            onClick={resetAll}
            className="whitespace-nowrap text-sm border border-neutral-300 px-3 min-h-[38px] rounded-lg hover:bg-neutral-100"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <Stat label="총 급여 (gross)" value={`${totals.gross.toLocaleString()}원`} />
        <Stat label="사업소득세 3.3%" value={`-${totals.tax.toLocaleString()}원`} />
        <Stat label="보너스 / 기타 공제" value={`+${totals.bonus.toLocaleString()} / -${totals.deduction.toLocaleString()}원`} />
        <Stat label="실 지급 (net)" value={`${totals.net.toLocaleString()}원`} highlight />
      </div>

      <div className="text-xs text-neutral-500 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg space-y-1">
        <p>💡 자동 집계는 lessons + group_sessions를 <b>수업 종류(수강권 상위 카테고리)별</b>로 채워넣어요. 각 카테고리는 강사의 카테고리별 시급(미설정 시 기본 시급)으로 계산됩니다. 개별 수업도 <b>예약(scheduled)되면 잡힙니다</b> — 사전 취소·삭제분은 제외. 회원별 전용 시급·인센티브는 자동으로 조정액에 반영. 보너스·공제는 수동.</p>
        <p>· <b className="text-blue-700">✨ 전체</b> = 그 달 예약된 모든 수업 기준. · <b className="text-emerald-700">📅 현 시점</b> = 오늘까지 진행된 수업만.</p>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {instructors.map(inst => {
        const edit = edits[inst.id]
        const result = calc(inst, edit)
        const cats = rowCategories(inst, edit, categories)
        const isSaving = saving[inst.id] ?? false
        return (
          <Card key={inst.id} className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {inst.color && <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: inst.color }} />}
                <span className="font-semibold">{inst.name}</span>
                <span className="text-xs text-neutral-500">
                  {inst.role === 'owner' ? '오너' : inst.role === 'admin' ? '관리자' : '강사'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={edit.paid} onChange={e => updateEdit(inst.id, { paid: e.target.checked })} />
                  지급 완료
                </label>
                <button type="button" onClick={() => applyAutoCounts(inst.id, false, 'full')} title="그 달 예약 전체" className="text-xs text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-md hover:bg-blue-50">자동(전체)</button>
                <button type="button" onClick={() => applyAutoCounts(inst.id, false, 'todate')} title="오늘까지 진행분" className="text-xs text-emerald-600 hover:text-emerald-700 px-2.5 py-1.5 rounded-md hover:bg-emerald-50">자동(현재)</button>
                <button type="button" onClick={() => resetInstructor(inst.id)} className="text-xs text-neutral-500 hover:text-neutral-700 px-2.5 py-1.5 rounded-md hover:bg-neutral-100">초기화</button>
                <button onClick={() => handleSave(inst)} disabled={isSaving} className="inline-flex items-center min-h-[38px] bg-blue-600 text-white px-4 rounded-lg text-sm shadow-sm hover:bg-blue-700 disabled:bg-blue-300">
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
              {cats.map(cat => (
                <CountInput
                  key={cat}
                  label={`${cat} (${instructorRateForCategory(inst, cat).toLocaleString()}/회)`}
                  value={edit.counts[cat] ?? ''}
                  onChange={v => setCount(inst.id, cat, v)}
                  subtotal={result.byCategory[cat] ?? 0}
                />
              ))}
            </div>

            {(result.adjustment !== 0 || (autoLines[inst.id]?.length ?? 0) > 0) && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-emerald-800">회원별 시급·인센티브 조정</span>
                  <span className={`font-semibold tabular-nums ${result.adjustment >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {result.adjustment >= 0 ? '+' : ''}{result.adjustment.toLocaleString()}원
                  </span>
                </div>
                {(autoLines[inst.id] ?? []).map(line => (
                  <div key={line.memberId} className="flex items-center justify-between text-emerald-700">
                    <span>
                      {line.memberName ?? `회원 #${line.memberId}`} · {line.lessonCount}회
                      {line.baseRate != null && <> · 단일 {line.baseRate.toLocaleString()}원</>}
                      {line.incentivePerSession > 0 && <> · 인센티브 +{line.incentivePerSession.toLocaleString()}/회</>}
                    </span>
                    <span className={`tabular-nums ${line.delta >= 0 ? '' : 'text-red-600'}`}>
                      {line.delta >= 0 ? '+' : ''}{line.delta.toLocaleString()}원
                    </span>
                  </div>
                ))}
                {result.adjustment !== 0 && (autoLines[inst.id]?.length ?? 0) === 0 && (
                  <div className="text-emerald-700/70">상세 내역은 &quot;자동 집계&quot;를 다시 누르면 표시됩니다.</div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <NumberInput label="총 급여" value={result.grossTotal} readOnly />
              <div>
                <label className="block text-xs text-neutral-600 mb-1">사업소득세 3.3%</label>
                <div className="w-full border border-neutral-200 bg-red-50 rounded-lg px-2 py-1.5 text-sm tabular-nums text-red-700">
                  -{result.taxWithholding.toLocaleString()}원
                </div>
              </div>
              <NumberInput label="보너스 (+)" value={result.bonus} onChange={v => updateEdit(inst.id, { bonus: String(v) })} />
              <NumberInput label="기타 공제 (-)" value={result.deduction} onChange={v => updateEdit(inst.id, { deduction: String(v) })} />
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <input
                type="text"
                value={edit.memo}
                onChange={e => updateEdit(inst.id, { memo: e.target.value })}
                placeholder="메모 (선택)"
                className="flex-1 mr-3 border border-neutral-300 rounded-lg px-3 py-2 text-sm"
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
      <label className="block text-xs text-neutral-600 mb-1 truncate" title={label}>{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        className="w-full border border-neutral-300 rounded-lg px-2 py-1.5 text-sm tabular-nums"
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
        <div className="w-full border border-neutral-200 bg-neutral-50 rounded-lg px-2 py-1.5 text-sm tabular-nums">
          {value.toLocaleString()}원
        </div>
      ) : (
        <input
          type="number"
          min="0"
          value={value || ''}
          onChange={e => onChange?.(parseInt(e.target.value, 10) || 0)}
          className="w-full border border-neutral-300 rounded-lg px-2 py-1.5 text-sm tabular-nums"
        />
      )}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-base sm:text-lg font-bold mt-1 tabular-nums tracking-tight break-keep ${highlight ? 'text-blue-600' : ''}`}>{value}</div>
    </Card>
  )
}
