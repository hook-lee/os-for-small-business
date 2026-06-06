'use client'

import { useMemo, useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'
import { instructorColor } from '@/lib/analytics/instructor-sort'
import { buildMonthGrid, getWeekDates, groupByDate } from '@/lib/analytics/lessons-view'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function pad(n: number): string { return String(n).padStart(2, '0') }

function getWeekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(d - dt.getDay())
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function formatKDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  const wd = WEEKDAYS[new Date(date + 'T00:00:00').getDay()]
  return `${m}월 ${d}일 (${wd})`
}

/**
 * 모바일 전용 점-캘린더. 주별=한 주 7칸, 월별=한 달 그리드.
 *  - 각 날짜 칸에 수업이 있으면 강사 색 점(최대 3) + 초과분 +N 표시.
 *  - 날짜를 탭하면 아래에 그날 수업이 시간순으로 나열됨 → 탭하면 상세 모달.
 *  드래그 이동은 PC(주별/월별 그리드)에서만. 모바일은 탭 인터랙션.
 */
export function MobileLessonCalendar({
  lessons,
  mode,
  anchor,
  onSelectLesson,
}: {
  lessons: UnifiedLesson[]
  mode: '주별' | '월별'
  anchor: string
  onSelectLesson: (l: UnifiedLesson) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const grouped = useMemo(() => groupByDate(lessons), [lessons])

  const cells = useMemo<Array<{ date: string | null }>>(() => {
    if (mode === '주별') return getWeekDates(getWeekStart(anchor)).map(date => ({ date }))
    return buildMonthGrid(anchor.slice(0, 7)).flat()
  }, [mode, anchor])

  // 선택 날짜: anchor는 항상 자기 주/월 범위에 포함됨 → 기본 anchor.
  const [selected, setSelected] = useState<string>(anchor)
  useEffect(() => { setSelected(anchor) }, [mode, anchor])

  const dayLessons = useMemo(() => {
    const list = grouped.get(selected) ?? []
    return [...list].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }, [grouped, selected])

  return (
    <div className="space-y-3">
      <Card className="p-2">
        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((wd, i) => (
            <div
              key={wd}
              className={`text-center text-[11px] py-1 font-medium ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-neutral-400'
              }`}
            >
              {wd}
            </div>
          ))}

          {cells.map((cell, i) => {
            if (!cell.date) return <div key={`e-${i}`} className="aspect-square" />
            const items = grouped.get(cell.date) ?? []
            const isToday = cell.date === today
            const isSelected = cell.date === selected
            const dayNum = parseInt(cell.date.slice(8), 10)
            const wd = new Date(cell.date + 'T00:00:00').getDay()
            const dotColors = items.slice(0, 3).map(l => instructorColor(l.instructorColor))
            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelected(cell.date!)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isToday
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-neutral-700 active:bg-neutral-100'
                }`}
              >
                <span className={`text-xs font-semibold ${
                  !isSelected && wd === 0 ? 'text-red-500' : !isSelected && wd === 6 ? 'text-blue-500' : ''
                }`}>
                  {dayNum}
                </span>
                <span className="flex items-center gap-0.5 h-1.5">
                  {dotColors.map((c, di) => (
                    <span
                      key={di}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.9)' : c }}
                    />
                  ))}
                  {items.length > 3 && (
                    <span className={`text-[8px] leading-none ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
                      +{items.length - 3}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="p-3">
        <div className="text-sm font-semibold text-neutral-700 mb-2">
          {formatKDate(selected)} · <span className="text-neutral-500 font-normal">{dayLessons.length}건</span>
        </div>
        {dayLessons.length === 0 ? (
          <div className="text-sm text-neutral-400 text-center py-6">이날 등록된 수업이 없습니다.</div>
        ) : (
          <ul className="space-y-1.5">
            {dayLessons.map(l => (
              <li key={`${l.type}-${l.id}`}>
                <button
                  type="button"
                  onClick={() => onSelectLesson(l)}
                  className="w-full text-left flex items-center gap-2 rounded-lg border border-neutral-200 border-l-4 px-2.5 py-2 active:bg-neutral-50"
                  style={{ borderLeftColor: instructorColor(l.instructorColor) }}
                >
                  <span className="text-sm font-bold tabular-nums w-12 shrink-0">{l.time ?? '—'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-neutral-800 truncate">
                      {l.type === 'group'
                        ? `${l.sessionName ?? '그룹'} (${l.reservedCount ?? 0}/${l.capacity ?? '—'})`
                        : (l.memberName ?? '—')}
                    </span>
                    <span className="block text-xs text-neutral-500 truncate">
                      {(l.instructorName ?? '강사미정')} · {l.type === 'group' ? '그룹' : (l.passName ?? '개인')}
                    </span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                    l.type === 'group' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {l.type === 'group' ? '그룹' : '개인'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
