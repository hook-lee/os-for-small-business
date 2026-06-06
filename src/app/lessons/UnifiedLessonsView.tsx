'use client'
import { toast } from '@/components/ui/toast'

import { useState, useMemo, useEffect, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Card } from '@/components/ui/Card'
import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'
import { DraggableLesson, DroppableDay } from './dnd'
import {
  type ViewMode,
  type LessonCategory,
  type TimeBand,
  groupByDate,
  getWeekDates,
  groupByTimeSlot,
  applyLessonFilters,
} from '@/lib/analytics/lessons-view'
import { instructorColor, type InstructorRef } from '@/lib/analytics/instructor-sort'
import { QuickAddLesson } from './QuickAddLesson'
import { LessonDetailModal } from './LessonDetailModal'
import { LessonsFilterBar } from './LessonsFilterBar'
import { DailyByInstructor } from './DailyByInstructor'
import { MonthlyCardList } from './MonthlyCardList'
import { MobileLessonCalendar } from './MobileLessonCalendar'
import { LessonHoverCard } from './LessonHoverCard'

type DailyLayout = '강사별' | '시간순'

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
  instructors,
}: {
  initialAnchor: string
  initialMode: ViewMode
  lessons: UnifiedLesson[]
  instructors: InstructorRef[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<ViewMode>(initialMode)
  const [anchor, setAnchor] = useState(initialAnchor)
  const [addOpen, setAddOpen] = useState(false)
  const [addPrefillDate, setAddPrefillDate] = useState(initialAnchor)
  const [detailLesson, setDetailLesson] = useState<UnifiedLesson | null>(null)

  // 드래그 이동용 로컬 사본 (낙관적 업데이트 → 실패 시 롤백). 서버 refresh되면 prop으로 재동기화.
  const [localLessons, setLocalLessons] = useState<UnifiedLesson[]>(lessons)
  useEffect(() => { setLocalLessons(lessons) }, [lessons])

  // 클릭(상세)과 드래그 구분: 마우스 8px 이동 / 터치 250ms 길게 누르면 드래그
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  async function moveLesson(lesson: UnifiedLesson, newDate: string) {
    if (lesson.date === newDate) return
    const apiBase = lesson.type === 'group' ? '/api/group-sessions' : '/api/lessons'
    const sameKey = (l: UnifiedLesson) => l.type === lesson.type && l.id === lesson.id
    // 낙관적 이동
    setLocalLessons(prev => prev.map(l => (sameKey(l) ? { ...l, date: newDate } : l)))
    try {
      const res = await fetch(`${apiBase}/${lesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonDate: newDate, lessonTime: lesson.time, roomId: lesson.roomId }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? '이동 실패')
      router.refresh()
    } catch (e) {
      // 롤백
      setLocalLessons(prev => prev.map(l => (sameKey(l) ? { ...l, date: lesson.date } : l)))
      toast(`수업 이동 실패: ${(e as Error).message}`)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const lesson = event.active.data.current?.lesson as UnifiedLesson | undefined
    const newDate = event.over?.data.current?.date as string | undefined
    if (lesson && newDate) moveLesson(lesson, newDate)
  }

  // 필터 상태
  const [category, setCategory] = useState<LessonCategory>('all')
  const [instructorFilter, setInstructorFilter] = useState<number | null>(null)
  const [timeBand, setTimeBand] = useState<TimeBand>('all')
  const [dailyLayout, setDailyLayout] = useState<DailyLayout>('강사별')

  function changeMode(m: ViewMode) {
    setMode(m)
    router.push(`/lessons?mode=${encodeURIComponent(m)}&date=${anchor}`)
  }
  function changeAnchor(newAnchor: string) {
    setAnchor(newAnchor)
    router.push(`/lessons?mode=${encodeURIComponent(mode)}&date=${newAnchor}`)
  }

  // 필터 적용된 lessons (드래그 이동 반영된 localLessons 기준)
  const filtered = useMemo(
    () => applyLessonFilters(localLessons, {
      category,
      timeBand: mode === '월별' ? timeBand : 'all',
      instructorId: instructorFilter,
    }),
    [localLessons, category, timeBand, mode, instructorFilter],
  )

  return (
    <div className="space-y-3">
      {/* 상단 필터 바 */}
      <LessonsFilterBar
        category={category}
        onCategoryChange={setCategory}
        instructors={instructors}
        instructorFilter={instructorFilter}
        onInstructorChange={setInstructorFilter}
        mode={mode}
        timeBand={timeBand}
        onTimeBandChange={setTimeBand}
      />

      {/* 모드 토글 + 네비게이션 + 추가 */}
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

      {/* 일별일 때 강사별/시간순 토글 */}
      {mode === '일별' && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500">레이아웃</span>
          <div className="flex gap-0.5 bg-neutral-100 p-0.5 rounded">
            {(['강사별', '시간순'] as DailyLayout[]).map(l => (
              <button
                key={l}
                onClick={() => setDailyLayout(l)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                  dailyLayout === l ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 통계 */}
      <Stats lessons={filtered} mode={mode} />

      {/* 빠른 추가 모달 */}
      <QuickAddLesson
        open={addOpen}
        onClose={() => setAddOpen(false)}
        prefillDate={addPrefillDate}
      />

      {/* 상세 모달 */}
      <LessonDetailModal
        lesson={detailLesson}
        open={!!detailLesson}
        onClose={() => setDetailLesson(null)}
      />

      {(mode === '주별' || mode === '월별') && (
        <div className="hidden md:block text-[11px] text-neutral-400">💡 카드를 다른 날로 <b>드래그</b>하면 그날로 이동합니다 (시간·룸 유지). 시간 변경은 카드 클릭.</div>
      )}
      {(mode === '주별' || mode === '월별') && (
        <div className="md:hidden text-[11px] text-neutral-400">💡 점이 있는 날을 탭하면 아래에 그날 수업이 펼쳐집니다. 수업을 탭하면 수정·삭제.</div>
      )}

      {/* 모바일 전용 — 주별/월별 점 캘린더 (PC 그리드가 좁은 화면에서 깨지는 문제 우회) */}
      {(mode === '주별' || mode === '월별') && (
        <div className="md:hidden">
          <MobileLessonCalendar
            lessons={filtered}
            mode={mode}
            anchor={anchor}
            onSelectLesson={setDetailLesson}
          />
        </div>
      )}

      {/* 뷰 본체 — 일별은 공통, 주별/월별 그리드는 PC 전용(md:block) */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {mode === '일별' && (
          dailyLayout === '강사별'
            ? <DailyByInstructor
                lessons={filtered.filter(l => l.date === anchor)}
                date={anchor}
                instructors={instructors}
                onSelectLesson={setDetailLesson}
              />
            : <DailyTimeline lessons={filtered} date={anchor} onSelectLesson={setDetailLesson} />
        )}
        {mode === '주별' && (
          <div className="hidden md:block">
            <WeeklyView
              lessons={filtered}
              weekStart={getWeekStart(anchor)}
              onSelectLesson={setDetailLesson}
            />
          </div>
        )}
        {mode === '월별' && (
          <div className="hidden md:block">
            <MonthlyCardList
              lessons={filtered}
              yearMonth={anchor.slice(0, 7)}
              onSelectDate={d => { changeMode('일별'); changeAnchor(d) }}
              onSelectLesson={setDetailLesson}
            />
          </div>
        )}
      </DndContext>
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
// 일별 — 시간순 리스트 (기존 패턴 유지, 색 + 호버 추가)
// ─────────────────────────────────────────────
function DailyTimeline({ lessons, date, onSelectLesson }: {
  lessons: UnifiedLesson[]
  date: string
  onSelectLesson: (l: UnifiedLesson) => void
}) {
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
            <th className="text-left px-3 py-2 w-20 whitespace-nowrap">시간</th>
            <th className="text-left px-3 py-2 w-28 whitespace-nowrap">룸</th>
            <th className="text-left px-3 py-2 w-28 whitespace-nowrap">수업 종류</th>
            <th className="text-left px-3 py-2 whitespace-nowrap">회원</th>
            <th className="text-left px-3 py-2 whitespace-nowrap">강사</th>
            <th className="text-right px-3 py-2 w-24 whitespace-nowrap">상태</th>
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(slot =>
            slot.map((l, slotIdx) => (
              <TimelineRow
                key={`${l.type}-${l.id}`}
                lesson={l}
                showTime={slotIdx === 0}
                slotIndex={slot.length > 1 ? slotIdx + 1 : null}
                slotTotal={slot.length > 1 ? slot.length : null}
                onSelect={() => onSelectLesson(l)}
              />
            )),
          )}
        </tbody>
      </table>
    </Card>
  )
}

function TimelineRow({
  lesson, showTime, slotIndex, slotTotal, onSelect,
}: {
  lesson: UnifiedLesson
  showTime: boolean
  slotIndex: number | null
  slotTotal: number | null
  onSelect: () => void
}) {
  const color = instructorColor(lesson.instructorColor)
  return (
    <tr
      onClick={onSelect}
      className="border-t border-neutral-100 hover:bg-blue-50/40 cursor-pointer"
      title="클릭해서 수정/삭제"
    >
      <td className="px-3 py-2 tabular-nums font-medium whitespace-nowrap">{showTime ? (lesson.time ?? '—') : ''}</td>
      <td className="px-3 py-2 text-xs text-neutral-600 truncate whitespace-nowrap max-w-[140px]">
        {lesson.roomName ?? (slotIndex && slotTotal ? <span className="text-neutral-400">미지정 {slotIndex}/{slotTotal}</span> : <span className="text-neutral-400">—</span>)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className={`text-xs px-2 py-0.5 rounded ${
          lesson.type === 'group' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {lesson.type === 'group' ? `그룹 · ${lesson.sessionName ?? '세션'}` : (lesson.passName ?? '개인')}
        </span>
      </td>
      <td className="px-3 py-2 text-neutral-700 whitespace-nowrap">
        {lesson.type === 'individual'
          ? (lesson.memberName ?? '—')
          : `${lesson.reservedCount ?? 0}/${lesson.capacity ?? '—'}명 예약`}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-neutral-700">
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          {lesson.instructorName ?? '미정'}
        </span>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {lesson.type === 'individual' ? (
          <StatusBadge status={lesson.status} />
        ) : (
          <a
            href={`/lessons/groups/${lesson.id}`}
            onClick={e => e.stopPropagation()}
            className="text-xs text-blue-600 hover:underline"
          >명단</a>
        )}
      </td>
    </tr>
  )
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
// 주별 — 7일 컬럼, 카드에 강사 색 보더 + 호버 툴팁
// ─────────────────────────────────────────────
function WeeklyView({ lessons, weekStart, onSelectLesson }: {
  lessons: UnifiedLesson[]
  weekStart: string
  onSelectLesson: (l: UnifiedLesson) => void
}) {
  const days = useMemo(() => getWeekDates(weekStart), [weekStart])
  const grouped = useMemo(() => groupByDate(lessons), [lessons])

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d, i) => {
        const dayLessons = grouped.get(d) ?? []
        const timeSlots = groupByTimeSlot(dayLessons)
        const date = new Date(d + 'T00:00:00')
        const dayNum = date.getDate()
        const wd = WEEKDAYS[i]
        const isToday = d === new Date().toISOString().slice(0, 10)
        const isWeekend = i === 0 || i === 6
        return (
          <DroppableDay key={d} date={d} className="bg-white rounded-lg border border-neutral-200 min-h-[200px] flex flex-col">
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
            <div className="flex-1 p-1 space-y-1 overflow-y-auto" style={{ maxHeight: '420px' }}>
              {timeSlots.length === 0 ? (
                <div className="text-[10px] text-neutral-300 text-center pt-4">—</div>
              ) : (
                timeSlots.map((slot, idx) => (
                  <div key={idx} className="flex gap-0.5">
                    {slot.map((l, roomIdx) => (
                      <DraggableLesson key={`${l.type}-${l.id}`} lesson={l} className="flex-1 min-w-0">
                        <WeekCard
                          lesson={l}
                          slotIndex={slot.length > 1 ? roomIdx + 1 : null}
                          slotTotal={slot.length > 1 ? slot.length : null}
                          onClick={() => onSelectLesson(l)}
                        />
                      </DraggableLesson>
                    ))}
                  </div>
                ))
              )}
            </div>
          </DroppableDay>
        )
      })}
    </div>
  )
}

function WeekCard({ lesson, slotIndex, slotTotal, onClick }: {
  lesson: UnifiedLesson
  slotIndex: number | null
  slotTotal: number | null
  onClick: () => void
}) {
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const isGroup = lesson.type === 'group'
  const bg = isGroup ? 'bg-purple-50 hover:bg-purple-100' : 'bg-blue-50 hover:bg-blue-100'
  const color = instructorColor(lesson.instructorColor)
  const roomLabel = lesson.roomName ?? (slotIndex && slotTotal ? `${slotIndex}/${slotTotal}` : null)

  function handleEnter(e: MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setHoverPos({ x: r.right + 4, y: r.top })
  }
  function handleLeave() { setHoverPos(null) }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`w-full min-w-0 text-left text-[10px] rounded border border-neutral-200 border-l-4 px-1.5 py-1 leading-tight ${bg} relative cursor-pointer transition-colors`}
        style={{ borderLeftColor: color }}
        title="호버하면 미리보기. 클릭하면 수정/삭제."
      >
        {roomLabel && (
          <span
            className="absolute top-0.5 right-0.5 text-[8px] font-bold text-neutral-500 tabular-nums bg-white/80 rounded px-0.5 leading-tight max-w-[60%] truncate"
            title={lesson.roomName ?? `${slotTotal}개 동시 진행 중 ${slotIndex}번째`}
          >
            {roomLabel}
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
      </button>

      {hoverPos && (
        <div className="hidden md:block fixed z-50" style={{ left: hoverPos.x, top: hoverPos.y }}>
          <LessonHoverCard lesson={lesson} />
        </div>
      )}
    </>
  )
}
