'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'
import { instructorColor } from '@/lib/analytics/instructor-sort'
import { buildMonthGrid, groupByDate } from '@/lib/analytics/lessons-view'
import { LessonCard } from './DailyByInstructor'

/**
 * 월별 — 시간+이름 압축 카드 리스트.
 *  - 셀당 최대 5개 카드 + 'N개 더보기' → 클릭시 일별로 이동
 *  - 카드 좌측 강사 색 보더
 *  - 호버시 LessonHoverCard (LessonCard 내부)
 */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MAX_CARDS_PER_CELL = 5

export function MonthlyCardList({
  lessons,            // 이미 카테고리/시간대/강사 필터 적용된 상태
  yearMonth,
  onSelectDate,
  onSelectLesson,
}: {
  lessons: UnifiedLesson[]
  yearMonth: string
  onSelectDate: (date: string) => void
  onSelectLesson: (l: UnifiedLesson) => void
}) {
  const grid = useMemo(() => buildMonthGrid(yearMonth), [yearMonth])
  const grouped = useMemo(() => {
    // 시간순 정렬 후 날짜별 그룹화
    const sorted = [...lessons].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    return groupByDate(sorted)
  }, [lessons])
  const today = new Date().toISOString().slice(0, 10)

  return (
    <Card className="p-2">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((wd, i) => (
          <div
            key={wd}
            className={`text-center text-xs py-1 font-medium ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-neutral-500'
            }`}
          >
            {wd}
          </div>
        ))}

        {grid.flat().map((cell, i) => {
          if (!cell.date) return <div key={`empty-${i}`} className="min-h-[120px]" />
          const items = grouped.get(cell.date) ?? []
          const visible = items.slice(0, MAX_CARDS_PER_CELL)
          const remaining = items.length - visible.length
          const isToday = cell.date === today
          const weekday = new Date(cell.date + 'T00:00:00').getDay()
          const dayNum = parseInt(cell.date.slice(8), 10)

          return (
            <div
              key={cell.date}
              className={`border border-neutral-100 rounded p-1 flex flex-col min-h-[120px] ${
                isToday ? 'bg-blue-50/40 border-blue-300' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1 px-0.5">
                <button
                  type="button"
                  onClick={() => onSelectDate(cell.date!)}
                  className={`text-xs font-semibold hover:underline ${
                    weekday === 0 ? 'text-red-500' : weekday === 6 ? 'text-blue-500' : 'text-neutral-700'
                  } ${isToday ? 'text-blue-700' : ''}`}
                >
                  {dayNum}
                </button>
                {items.length > 0 && (
                  <span className="text-[9px] text-neutral-400 tabular-nums">{items.length}</span>
                )}
              </div>

              <div className="flex-1 space-y-0.5">
                {visible.map(l => (
                  <CompactCard
                    key={`${l.type}-${l.id}`}
                    lesson={l}
                    onClick={() => onSelectLesson(l)}
                  />
                ))}
                {remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDate(cell.date!)}
                    className="w-full text-[10px] text-blue-600 hover:underline text-left px-1 py-0.5"
                  >
                    {remaining}개 더보기
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 text-[10px] text-neutral-400 px-1">
        💡 날짜 클릭 → 일별 상세. 카드 호버 → 회원·강사·잔여 미리보기. 카드 클릭 → 수정·삭제.
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────
// 월별 셀 안에 들어가는 더 압축된 카드 (LessonCard 재사용은 공간 부족)
function CompactCard({ lesson, onClick }: { lesson: UnifiedLesson; onClick: () => void }) {
  // 작은 화면에서 셀 너비가 좁아 LessonCard가 너무 큼 → 한 줄 카드.
  // 호버 툴팁은 LessonCard와 같은 패턴 — but inline impl. would balloon this file,
  // so reuse LessonCard via a small wrapper.
  return (
    <LessonCard
      lesson={lesson}
      color={instructorColor(lesson.instructorColor)}
      onClick={onClick}
    />
  )
}
