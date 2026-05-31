'use client'

import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'
import { instructorColor } from '@/lib/analytics/instructor-sort'

/**
 * 카드 호버 시 표시되는 상세 툴팁.
 *
 * 모바일(터치 디바이스)에선 호버 이벤트가 의미 없어 click 폴백을 LessonDetailModal이 처리.
 * 이 컴포넌트는 단순한 presentational + position absolute.
 *
 * Usage:
 *  - 부모가 mouseenter/leave로 상태 토글 → 본 컴포넌트 conditional render
 *  - 위치는 부모가 px 좌표 전달
 */

const STATUS_LABEL: Record<string, string> = {
  scheduled: '예약',
  completed: '완료',
  cancelled_same_day: '당일취소',
  cancelled_advance: '사전취소',
  noshow: '노쇼',
}

export function LessonHoverCard({ lesson }: { lesson: UnifiedLesson }) {
  const isGroup = lesson.type === 'group'
  const color = instructorColor(lesson.instructorColor)
  const dateLabel = formatDate(lesson.date, lesson.time, lesson.durationMinutes)

  return (
    <div className="bg-white rounded-lg shadow-xl border border-neutral-200 p-3 w-64 text-xs space-y-2 pointer-events-none">
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-6 rounded-sm"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-neutral-900 truncate">
            {isGroup ? lesson.sessionName : (lesson.memberName ?? '이름 없음')}
          </div>
          <div className="text-neutral-500 text-[11px]">{dateLabel}</div>
        </div>
      </div>

      <div className="space-y-1 text-neutral-700">
        <Row label="강사" value={lesson.instructorName ?? '미정'} />
        <Row label="룸"   value={lesson.roomName ?? '미정'} />
        {isGroup ? (
          <>
            <Row label="유형" value="그룹" />
            <Row label="예약" value={`${lesson.reservedCount ?? 0}/${lesson.capacity ?? '—'}명`} />
          </>
        ) : (
          <>
            <Row label="유형" value={lesson.passName ?? '개인'} />
            {lesson.passRemaining !== null && (
              <Row label="잔여" value={`${lesson.passRemaining}회`} />
            )}
            {lesson.status && (
              <Row label="상태" value={STATUS_LABEL[lesson.status] ?? lesson.status} />
            )}
          </>
        )}
      </div>

      <div className="text-[10px] text-neutral-400 pt-1 border-t border-neutral-100">
        클릭하면 수정·삭제 가능
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-800 text-right truncate">{value}</span>
    </div>
  )
}

function formatDate(date: string, time: string | null, durationMin: number): string {
  // 2026-05-21 + 19:00 + 50 → '2026.5.21 (목) 19:00~19:50'
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const weekday = ['일','월','화','수','목','금','토'][dt.getDay()]
  const dateStr = `${y}.${m}.${d} (${weekday})`
  if (!time) return dateStr
  const [hh, mm] = time.split(':').map(Number)
  const endH = Math.floor((hh * 60 + mm + durationMin) / 60)
  const endM = (hh * 60 + mm + durationMin) % 60
  const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  return `${dateStr} ${time}~${endStr}`
}
