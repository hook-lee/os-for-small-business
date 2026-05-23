'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { LessonWithNames, LessonStatus } from '@/lib/supabase/lessons'
import { STATUS_LABEL } from '@/lib/supabase/lessons'
import type { Instructor } from '@/lib/supabase/instructors'

function buildMonthGrid(yearMonth: string): { date: string | null }[][] {
  const [y, m] = yearMonth.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0).getDate()
  const startWeekday = first.getDay() // 0=일

  const cells: { date: string | null }[] = []
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null })
  for (let d = 1; d <= lastDay; d++) {
    const ds = `${yearMonth}-${String(d).padStart(2, '0')}`
    cells.push({ date: ds })
  }
  while (cells.length % 7 !== 0) cells.push({ date: null })

  const rows: { date: string | null }[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

const STATUS_OPTIONS: LessonStatus[] = ['scheduled', 'completed', 'cancelled_same_day', 'cancelled_advance', 'noshow']

const STATUS_COLOR: Record<LessonStatus, string> = {
  scheduled: 'bg-neutral-100 text-neutral-700',
  completed: 'bg-green-100 text-green-700',
  cancelled_same_day: 'bg-amber-100 text-amber-700',
  cancelled_advance: 'bg-neutral-100 text-neutral-500',
  noshow: 'bg-red-100 text-red-700',
}

interface Member { id: number; name: string; phone: string | null }
interface PassOption { id: number; passName: string; remainingCount: number | null; status: string | null }

export function LessonsManager({ initialDate, initialLessons, monthLessons = [], instructors }: {
  initialDate: string
  initialLessons: LessonWithNames[]
  monthLessons?: LessonWithNames[]
  instructors: Instructor[]
}) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [lessons, setLessons] = useState<LessonWithNames[]>(initialLessons)
  const [addOpen, setAddOpen] = useState(false)
  const [error, setError] = useState('')

  // Add form state
  const [members, setMembers] = useState<Member[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [memberPasses, setMemberPasses] = useState<PassOption[]>([])
  const [selectedPassId, setSelectedPassId] = useState<number | null>(null)
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null)
  const [lessonTime, setLessonTime] = useState('10:00')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (addOpen && members.length === 0) {
      fetch('/api/members').then(r => r.json()).then((j: { members?: Member[] }) => setMembers(j.members ?? []))
    }
  }, [addOpen, members.length])

  useEffect(() => {
    const match = members.find(m => m.name === memberQuery)
    setSelectedMemberId(match?.id ?? null)
  }, [memberQuery, members])

  useEffect(() => {
    if (selectedMemberId) {
      fetch(`/api/members/${selectedMemberId}/passes`).then(r => r.json())
        .then((j: { passes?: PassOption[] }) => setMemberPasses(j.passes ?? []))
        .catch(() => setMemberPasses([]))
    } else {
      setMemberPasses([])
      setSelectedPassId(null)
    }
  }, [selectedMemberId])

  function changeDate(newDate: string) {
    setDate(newDate)
    router.push(`/lessons?date=${newDate}`)
    router.refresh()
  }

  async function reloadLessons() {
    const res = await fetch(`/api/lessons?date=${date}`)
    if (res.ok) {
      const j = await res.json() as { lessons: LessonWithNames[] }
      setLessons(j.lessons)
    }
  }

  async function handleAdd() {
    if (!selectedMemberId) { setError('회원을 선택하세요'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMemberId,
          passId: selectedPassId,
          instructorId: selectedInstructorId,
          lessonDate: date,
          lessonTime,
          memo: memo || undefined,
        }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? '저장 실패'); return }
      // Reset form
      setMemberQuery(''); setSelectedMemberId(null); setSelectedPassId(null)
      setSelectedInstructorId(null); setMemo('')
      setAddOpen(false)
      await reloadLessons()
    } catch {
      setError('네트워크 오류')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(lessonId: number, newStatus: LessonStatus) {
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json() as { ok?: boolean; deductionDelta?: number; error?: string }
      if (!res.ok) { alert(`상태 변경 실패: ${json.error}`); return }
      await reloadLessons()
    } catch { alert('네트워크 오류') }
  }

  async function handleDelete(l: LessonWithNames) {
    const label = `${l.lessonTime ?? '시간미정'} ${l.memberName}`
    if (!confirm(`${label}\n삭제할까요? (차감됐다면 회차 자동 복원)`)) return
    try {
      const res = await fetch(`/api/lessons/${l.id}`, { method: 'DELETE' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { alert(`삭제 실패: ${json.error}`); return }
      await reloadLessons()
    } catch { alert('네트워크 오류') }
  }

  const deductedCount = useMemo(() => lessons.filter(l => l.deducted).length, [lessons])

  const currentMonth = date.slice(0, 7)
  const monthGrid = useMemo(() => buildMonthGrid(currentMonth), [currentMonth])

  const countsByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of monthLessons) {
      map.set(l.lessonDate, (map.get(l.lessonDate) ?? 0) + 1)
    }
    return map
  }, [monthLessons])

  function shiftMonth(delta: number) {
    const [y, m] = currentMonth.split('-').map(Number)
    const next = new Date(y, m - 1 + delta, 1)
    const newMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    const newDate = `${newMonth}-01`
    changeDate(newDate)
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => shiftMonth(-1)} className="text-sm px-2 py-1 hover:bg-neutral-100 rounded">‹ 이전달</button>
          <div className="font-semibold">{currentMonth}</div>
          <button onClick={() => shiftMonth(1)} className="text-sm px-2 py-1 hover:bg-neutral-100 rounded">다음달 ›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs">
          {['일', '월', '화', '수', '목', '금', '토'].map((wd, i) => (
            <div key={wd} className={`text-center py-1 text-neutral-500 font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}`}>{wd}</div>
          ))}
          {monthGrid.flat().map((cell, i) => {
            if (!cell.date) return <div key={i} className="aspect-square" />
            const count = countsByDate.get(cell.date) ?? 0
            const isSelected = cell.date === date
            const isToday = cell.date === new Date().toISOString().slice(0, 10)
            const weekday = new Date(cell.date + 'T00:00:00').getDay()
            return (
              <button
                key={cell.date}
                onClick={() => changeDate(cell.date!)}
                className={`aspect-square rounded p-1 text-xs hover:bg-blue-50 transition-colors flex flex-col items-center justify-center ${
                  isSelected ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : isToday ? 'border border-blue-400'
                  : ''
                }`}
              >
                <span className={`${weekday === 0 ? 'text-red-500' : weekday === 6 ? 'text-blue-500' : ''} ${isSelected ? '!text-white' : ''}`}>
                  {parseInt(cell.date.slice(8), 10)}
                </span>
                {count > 0 && (
                  <span className={`text-xs ${isSelected ? 'text-blue-100' : 'text-blue-600'}`}>
                    {count}건
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">
          수업 <span className="text-neutral-400 text-sm font-normal">{date} · 총 {lessons.length}건, 차감 {deductedCount}건</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDate(new Date().toISOString().slice(0, 10))}
            className="text-xs border border-neutral-300 px-2 py-1 rounded hover:bg-neutral-100"
          >
            오늘로
          </button>
          <input
            type="date"
            value={date}
            onChange={e => changeDate(e.target.value)}
            className="border border-neutral-300 rounded px-2 py-1 text-sm"
          />
          <button
            onClick={() => { setAddOpen(o => !o); setError('') }}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
          >
            {addOpen ? '취소' : '+ 수업 추가'}
          </button>
        </div>
      </div>

      <div className="text-xs text-neutral-500 bg-blue-50 border border-blue-200 px-3 py-2 rounded">
        💡 회차 차감 룰: <strong>완료 / 당일 취소 / 노쇼</strong> → 차감 / <strong>사전 취소</strong> → 미차감.
        상태 변경 시 자동으로 회원의 수강권 잔여 횟수가 조정됩니다.
      </div>

      {addOpen && (
        <Card>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-neutral-600 mb-1">회원 *</label>
              <input
                type="text"
                list="lesson-member-options"
                value={memberQuery}
                onChange={e => setMemberQuery(e.target.value)}
                placeholder="회원 이름"
                className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
              />
              <datalist id="lesson-member-options">
                {members.map(m => <option key={m.id} value={m.name}>{m.phone ?? ''}</option>)}
              </datalist>
              {selectedMemberId && <div className="text-xs text-blue-600 mt-1">✓ 매칭됨 (id={selectedMemberId})</div>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-neutral-600 mb-1">수강권 (차감 대상)</label>
                <select
                  value={selectedPassId ?? ''}
                  onChange={e => setSelectedPassId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
                  disabled={!selectedMemberId}
                >
                  <option value="">선택 안 함 (차감 없음)</option>
                  {memberPasses.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.passName} · 잔여 {p.remainingCount ?? 0}회
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-600 mb-1">담당 강사</label>
                <select
                  value={selectedInstructorId ?? ''}
                  onChange={e => setSelectedInstructorId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
                >
                  <option value="">선택 안 함</option>
                  {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-neutral-600 mb-1">시간</label>
                <input
                  type="time"
                  value={lessonTime}
                  onChange={e => setLessonTime(e.target.value)}
                  className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-600 mb-1">메모</label>
                <input
                  type="text"
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="(선택)"
                  className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
                />
              </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={saving || !selectedMemberId}
                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:bg-blue-300"
              >
                {saving ? '저장 중...' : '예약 추가'}
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {lessons.map(l => (
          <Card key={l.id} className="flex items-center gap-3">
            <div className="text-sm font-medium tabular-nums w-14">{l.lessonTime ?? '—'}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <a href={`/members/${l.memberId}`} className="font-medium hover:underline text-blue-600">
                  {l.memberName}
                </a>
                <span className="text-xs text-neutral-500">{l.instructorName ?? '강사 미정'}</span>
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {l.passName ? `${l.passName} (잔여 ${l.passRemaining ?? '?'}회)` : '수강권 미연동'}
                {l.memo && ` · ${l.memo}`}
              </div>
            </div>
            <select
              value={l.status}
              onChange={e => handleStatusChange(l.id, e.target.value as LessonStatus)}
              className={`text-xs rounded px-2 py-1 border-0 ${STATUS_COLOR[l.status]}`}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button
              onClick={() => handleDelete(l)}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
            >
              삭제
            </button>
          </Card>
        ))}
        {lessons.length === 0 && (
          <Card>
            <div className="text-sm text-neutral-400 text-center">이날 등록된 수업이 없습니다.</div>
          </Card>
        )}
      </div>
    </div>
  )
}
