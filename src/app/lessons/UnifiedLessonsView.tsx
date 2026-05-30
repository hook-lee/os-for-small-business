'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'
import {
  type ViewMode,
  groupByDate,
  countByDate,
  getWeekDates,
  buildMonthGrid,
  sortByTime,
  lessonTypeLabel,
  groupByTimeSlot,
} from '@/lib/analytics/lessons-view'
import { QuickAddLesson } from './QuickAddLesson'

const MODES: ViewMode[] = ['일별', '주별', '월별']
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function pad(n: number): string { return String(n).padStart(2, '0') }
function shiftDay(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(d + days)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const dt = new Date(y, m - 1 + delta, 1)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-01`
}

export function UnifiedLessonsView({
  initialAnchor,
  initialMode,
  lessons,
}: {
  initialAnchor: string
  initialMode: ViewMode
  lessons: UnifiedLesson[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<ViewMode>(initialMode)
  const [anchor, setAnchor] = useState(initialAnchor)
  const [addOpen, setAddOpen] = useState(false)
  const [addPrefillDate, setAddPrefillDate] = useState(initialAnchor)

  function changeMode(m: ViewMode) {
    setMode(m)
    router.push(`/lessons?mode=${encodeURIComponent(m)}&date=${anchor}`)
  }
  function changeAnchor(newAnchor: string) {
    setAnchor(newAnchor)
    router.push(`/lessons?mode=${encodeURIComponent(mode)}&date=${newAnchor}`)
  }

  return (
    <div className="space-y-4">
      {/* 헤더: 모드 토글 + 날짜 네비게이션 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-neutral-100 p-0.5 rounded-lg">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => changeMode(m)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === m ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <NavButtons mode={mode} anchor={anchor} onChange={changeAnchor} />
          <button
            onClick={() => { setAddPrefillDate(anchor); setAddOpen(true) }}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded shadow-sm"
          >
            + 수업 추가
          </button>
        </div>
      </div>

      {/* 통계 (상단) */}
      <Stats lessons={lessons} mode={mode} />

      {/* 빠른 추가 모달 */}
      <QuickAddLesson
        open={addOpen}
        onClose={() => setAddOpen(false)}
        prefillDate={addPrefillDate}
      />

      {/* 뷰 본체 */}
      {mode === '일별' && <DailyView lessons={lessons} date={anchor} />}
      {mode === '주별' && <WeeklyView lessons={lessons} weekStart={getWeekStart(anchor)} />}
      {mode === '월별' && <MonthlyView lessons={lessons} yearMonth={anchor.slice(0, 7)} onSelectDate={d => { changeMode('일별'); changeAnchor(d) }} />}
    </div>
  )
}

// ─────────────────────────────────────────────
function getWeekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(d - dt.getDay())
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

// ─────────────────────────────────────────────
function NavButtons({ mode, anchor, onChange }: {
  mode: ViewMode
  anchor: string
  onChange: (newAnchor: string) => void
}) {
  function go(delta: number) {
    if (mode === '일별') onChange(shiftDay(anchor, delta))
    else if (mode === '주별') onChange(shiftDay(anchor, delta * 7))
    else onChange(shiftMonth(anchor.slice(0, 7), delta) + anchor.slice(7))
  }
  const today = new Date().toISOString().slice(0, 10)
  return (
    <>
      <button onClick={() => go(-1)} className="text-sm px-2 py-1 hover:bg-neutral-100 rounded">‹</button>
      <button onClick={() => onChange(today)} className="text-xs border border-neutral-300 px-2 py-1 rounded hover:bg-neutral-100">오늘</button>
      <input
        type={mode === '월별' ? 'month' : 'date'}
        value={mode === '월별' ? anchor.slice(0, 7) : anchor}
        onChange={e => onChange(mode === '월별' ? `${e.target.value}-01` : e.target.value)}
        className="border border-neutral-300 rounded px-2 py-1 text-sm"
      />
      <button onClick={() => go(1)} className="text-sm px-2 py-1 hover:bg-neutral-100 rounded">›</button>
    </>
  )
}

// ─────────────────────────────────────────────
function Stats({ lessons, mode }: { lessons: UnifiedLesson[]; mode: ViewMode }) {
  const ind = lessons.filter(l => l.type === 'individual').length
  const grp = lessons.filter(l => l.type === 'group').length
  return (
    <div className="flex gap-3 text-sm text-neutral-600">
      <span>{mode} · 총 <strong className="text-neutral-900">{lessons.length}건</strong></span>
      <span className="text-neutral-300">·</span>
      <span>개별 {ind}건</span>
      <span className="text-neutral-300">·</span>
      <span>그룹 {grp}건</span>
    </div>
  )
}

// ─────────────────────────────────────────────
// 일별 — 시간순 리스트 (가장 상세)
// ─────────────────────────────────────────────
function DailyView({ lessons, date }: { lessons: UnifiedLesson[]; date: string }) {
  // 같은 시간 묶음 — 룸 indicator용
  const timeSlots = useMemo(
    () => groupByTimeSlot(lessons.filter(l => l.date === date)),
    [lessons, date],
  )

  if (timeSlots.length === 0) {
    return <Card><div className="text-sm text-neutral-400 text-center py-6">이날 등록된 수업이 없습니다.</div></Card>
  }
  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
          <tr>
            <th className="text-left px-3 py-2 w-20">시간</th>
            <th className="text-left px-3 py-2 w-14">룸</th>
            <th className="text-left px-3 py-2 w-24">수업 종류</th>
            <th className="text-left px-3 py-2">회원</th>
            <th className="text-left px-3 py-2">강사</th>
            <th className="text-right px-3 py-2 w-20">상태</th>
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(slot =>
            slot.map((l, roomIdx) => (
              <tr key={`${l.type}-${l.id}`} className="border-t border-neutral-100">
                <td className="px-3 py-2 tabular-nums font-medium">{roomIdx === 0 ? (l.time ?? '—') : ''}</td>
                <td className="px-3 py-2 text-xs text-neutral-500 tabular-nums">
                  {slot.length > 1 ? `${roomIdx + 1}/${slot.length}` : '—'}
                </td>
                <td className="px-3 py-2"><TypeBadge lesson={l} /></td>
                <td className="px-3 py-2 text-neutral-700">
                  {l.type === 'individual'
                    ? (l.memberName ?? '—')
                    : `${l.reservedCount ?? 0}/${l.capacity ?? '—'}명 예약`}
                </td>
                <td className="px-3 py-2 text-neutral-600">{l.instructorName ?? '강사 미정'}</td>
                <td className="px-3 py-2 text-right">
                  {l.type === 'individual' ? (
                    <StatusBadge status={l.status} />
                  ) : (
                    <a href={`/lessons/groups/${l.id}`} className="text-xs text-blue-600 hover:underline">명단</a>
                  )}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </Card>
  )
}

function TypeBadge({ lesson }: { lesson: UnifiedLesson }) {
  const label = lessonTypeLabel(lesson)
  const color = lesson.type === 'group' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
  return <span className={`text-xs px-2 py-0.5 rounded ${color}`}>{label}</span>
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-neutral-400">—</span>
  const map: Record<string, { label: string; cls: string }> = {
    scheduled: { label: '예약', cls: 'bg-neutral-100 text-neutral-700' },
    completed: { label: '완료', cls: 'bg-green-100 text-green-700' },
    cancelled_same_day: { label: '당일취소', cls: 'bg-amber-100 text-amber-700' },
    cancelled_advance: { label: '사전취소', cls: 'bg-neutral-100 text-neutral-500' },
    noshow: { label: '노쇼', cls: 'bg-red-100 text-red-700' },
  }
  const e = map[status] ?? { label: status, cls: 'bg-neutral-100 text-neutral-500' }
  return <span className={`text-xs px-2 py-0.5 rounded ${e.cls}`}>{e.label}</span>
}

// ─────────────────────────────────────────────
// 주별 — 7일 column, 각 day에 lesson 카드 list
// ─────────────────────────────────────────────
function WeeklyView({ lessons, weekStart }: { lessons: UnifiedLesson[]; weekStart: string }) {
  const days = useMemo(() => getWeekDates(weekStart), [weekStart])
  const grouped = useMemo(() => groupByDate(lessons), [lessons])

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d, i) => {
        const dayLessons = grouped.get(d) ?? []
        const timeSlots = groupByTimeSlot(dayLessons)   // 같은 시간끼리 묶음 (룸 처리)
        const date = new Date(d + 'T00:00:00')
        const dayNum = date.getDate()
        const wd = WEEKDAYS[i]
        const isToday = d === new Date().toISOString().slice(0, 10)
        const isWeekend = i === 0 || i === 6
        return (
          <div key={d} className="bg-white rounded-lg border border-neutral-200 min-h-[200px] flex flex-col">
            <div className={`px-2 py-1.5 border-b border-neutral-100 flex items-center justify-between ${
              isToday ? 'bg-blue-50' : ''
            }`}>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-neutral-500'}`}>{wd}</span>
                <span className={`text-sm font-semibold ${isWeekend ? '' : 'text-neutral-800'} ${isToday ? 'text-blue-700' : ''}`}>{dayNum}</span>
              </div>
              {dayLessons.length > 0 && (
                <span className="text-[10px] text-neutral-400 tabular-nums">{dayLessons.length}</span>
              )}
            </div>
            <div className="flex-1 p-1 space-y-1 overflow-y-auto" style={{ maxHeight: '380px' }}>
              {timeSlots.length === 0 ? (
                <div className="text-[10px] text-neutral-300 text-center pt-4">—</div>
              ) : (
                timeSlots.map((slot, idx) => (
                  <div key={idx} className="flex gap-0.5">
                    {slot.map((l, roomIdx) => (
                      <WeekCard
                        key={`${l.type}-${l.id}`}
                        lesson={l}
                        roomIndex={slot.length > 1 ? roomIdx + 1 : null}
                        roomTotal={slot.length > 1 ? slot.length : null}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WeekCard({ lesson, roomIndex, roomTotal }: {
  lesson: UnifiedLesson
  roomIndex: number | null   // 1, 2, ... (룸 표시용. null이면 단독)
  roomTotal: number | null
}) {
  const isGroup = lesson.type === 'group'
  const bg = isGroup ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'
  return (
    <div className={`flex-1 min-w-0 text-[10px] rounded border px-1.5 py-1 leading-tight ${bg} relative`}>
      {roomIndex !== null && roomTotal !== null && (
        <span
          className="absolute top-0.5 right-0.5 text-[8px] font-bold text-neutral-400 tabular-nums bg-white/80 rounded px-0.5 leading-tight"
          title={`${roomTotal}개 동시 진행 중 ${roomIndex}번째`}
        >
          {roomIndex}/{roomTotal}
        </span>
      )}
      <div className="font-bold tabular-nums">{lesson.time ?? '—'}</div>
      <div className="text-neutral-700 truncate">
        {isGroup
          ? `${lesson.sessionName ?? '그룹'} (${lesson.reservedCount ?? 0}/${lesson.capacity ?? '—'})`
          : (lesson.memberName ?? '—')}
      </div>
      <div className="text-neutral-500 truncate">
        {(lesson.instructorName ?? '강사미정')} · {isGroup ? '그룹' : (lesson.passName ?? '개인')}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 월별 — 캘린더 그리드, 셀에 건수만 (기존 패턴)
// ─────────────────────────────────────────────
function MonthlyView({ lessons, yearMonth, onSelectDate }: {
  lessons: UnifiedLesson[]
  yearMonth: string
  onSelectDate: (date: string) => void
}) {
  const grid = useMemo(() => buildMonthGrid(yearMonth), [yearMonth])
  const counts = useMemo(() => countByDate(lessons), [lessons])
  const today = new Date().toISOString().slice(0, 10)

  return (
    <Card>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {WEEKDAYS.map((wd, i) => (
          <div key={wd} className={`text-center py-1 font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-neutral-500'}`}>{wd}</div>
        ))}
        {grid.flat().map((cell, i) => {
          if (!cell.date) return <div key={i} className="aspect-square" />
          const c = counts.get(cell.date)
          const isToday = cell.date === today
          const weekday = new Date(cell.date + 'T00:00:00').getDay()
          return (
            <button
              key={cell.date}
              onClick={() => onSelectDate(cell.date!)}
              className={`aspect-square rounded p-1 text-xs hover:bg-blue-50 transition-colors flex flex-col items-center justify-start ${
                isToday ? 'border border-blue-400 bg-blue-50/50' : ''
              }`}
            >
              <span className={`text-xs ${weekday === 0 ? 'text-red-500' : weekday === 6 ? 'text-blue-500' : 'text-neutral-700'}`}>
                {parseInt(cell.date.slice(8), 10)}
              </span>
              {c && c.total > 0 && (
                <div className="mt-0.5 flex flex-col items-center text-[9px] leading-tight">
                  <span className="text-blue-600 font-semibold">{c.total}건</span>
                  {c.individual > 0 && c.group > 0 && (
                    <span className="text-neutral-400">{c.individual}+{c.group}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[10px] text-neutral-400">
        <span><span className="text-blue-600 font-semibold">●</span> 개별</span>
        <span><span className="text-purple-600 font-semibold">●</span> 그룹</span>
        <span>날짜 클릭 → 일별 상세</span>
      </div>
    </Card>
  )
}
