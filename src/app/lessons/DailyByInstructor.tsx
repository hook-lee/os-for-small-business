'use client'

import { useMemo, useState, type MouseEvent } from 'react'
import { Card } from '@/components/ui/Card'
import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'
import { instructorColor, sortInstructorsByRoleAndName, type InstructorRef } from '@/lib/analytics/instructor-sort'
import { LessonHoverCard } from './LessonHoverCard'

/**
 * 일별 — 강사별 컬럼 레이아웃.
 *
 *  - 컬럼: 원장(role='owner') 가장 왼쪽 → 나머지 강사 이름순
 *  - 일정에 출현한 강사 + 활성 강사 전체 표시 (당일 일정 없는 강사 컬럼도 노출)
 *  - 카드: 시간 + 회원/세션. 강사 색 좌측 보더.
 *  - 호버시 LessonHoverCard 표시.
 *
 * 시간 범위: 데이터에 등장한 최소~최대 시간 ±1시간을 30분 단위로 그리지 않고,
 * 본 first cut은 단순 리스트로 (이른 시간순). 향후 picas 같은 그리드 도입은 별도 작업.
 */
export function DailyByInstructor({
  lessons,
  date,
  instructors,
  onSelectLesson,
}: {
  lessons: UnifiedLesson[]   // 이미 date + 필터 적용된 상태로 받음
  date: string
  instructors: InstructorRef[]
  onSelectLesson: (l: UnifiedLesson) => void
}) {
  // 강사 정렬: 원장 → 이름순
  const sortedInstructors = useMemo(() => sortInstructorsByRoleAndName(instructors), [instructors])

  // 강사별 그룹화 (instructorId가 null인 수업은 별도 '강사 미정' 컬럼)
  const byInstructor = useMemo(() => {
    const map = new Map<number | 'unassigned', UnifiedLesson[]>()
    for (const l of lessons) {
      const key: number | 'unassigned' = l.instructorId ?? 'unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(l)
    }
    // 시간순 정렬
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    }
    return map
  }, [lessons])

  // 컬럼 = 활성 강사들 + (강사 미정 수업이 있으면 그 컬럼도 우측 끝에)
  const hasUnassigned = byInstructor.has('unassigned')

  if (sortedInstructors.length === 0 && !hasUnassigned) {
    return (
      <Card>
        <div className="text-sm text-neutral-400 text-center py-6">
          등록된 강사가 없거나 이날 수업이 없습니다.
        </div>
      </Card>
    )
  }

  return (
    <div className="bg-white rounded-xl overflow-x-auto border border-neutral-200">
      <div className="grid auto-cols-fr grid-flow-col min-w-fit">
        {sortedInstructors.map(ins => (
          <InstructorColumn
            key={ins.id}
            instructor={ins}
            lessons={byInstructor.get(ins.id) ?? []}
            onSelectLesson={onSelectLesson}
          />
        ))}
        {hasUnassigned && (
          <InstructorColumn
            key="unassigned"
            instructor={{ id: -1, name: '강사 미정', role: null, color: null }}
            lessons={byInstructor.get('unassigned') ?? []}
            onSelectLesson={onSelectLesson}
          />
        )}
      </div>
      {lessons.length === 0 && (
        <div className="text-xs text-neutral-400 text-center py-6 border-t border-neutral-100">
          이날({date}) 등록된 수업이 없습니다.
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
function InstructorColumn({
  instructor,
  lessons,
  onSelectLesson,
}: {
  instructor: InstructorRef
  lessons: UnifiedLesson[]
  onSelectLesson: (l: UnifiedLesson) => void
}) {
  const color = instructorColor(instructor.color)
  return (
    <div className="min-w-[180px] border-l border-neutral-100 first:border-l-0">
      {/* 헤더 */}
      <div className="px-2 py-2 border-b border-neutral-100 bg-neutral-50 flex items-center gap-1.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-sm"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span className="text-sm font-semibold text-neutral-800 truncate">
          {instructor.role === 'owner' && '⭐ '}
          {instructor.name}
        </span>
        <span className="text-[10px] text-neutral-400 ml-auto tabular-nums">
          {lessons.length}
        </span>
      </div>

      {/* 카드 리스트 (시간순) */}
      <div className="p-2 space-y-1 min-h-[120px]">
        {lessons.length === 0 ? (
          <div className="text-[11px] text-neutral-300 text-center py-4">—</div>
        ) : (
          lessons.map(l => (
            <LessonCard
              key={`${l.type}-${l.id}`}
              lesson={l}
              color={color}
              onClick={() => onSelectLesson(l)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
export function LessonCard({
  lesson,
  color,
  onClick,
}: {
  lesson: UnifiedLesson
  color: string
  onClick: () => void
}) {
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)

  function handleEnter(e: MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setHoverPos({ x: r.right + 8, y: r.top })
  }
  function handleLeave() {
    setHoverPos(null)
  }

  const isGroup = lesson.type === 'group'

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="w-full text-left rounded border-l-4 border border-neutral-200 hover:border-blue-300 hover:bg-blue-50/30 px-2 py-1.5 transition-colors group"
        style={{ borderLeftColor: color }}
      >
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-[11px] font-semibold tabular-nums text-neutral-800">
            {lesson.time ?? '시간 미정'}
          </span>
          <span className={`text-[9px] px-1.5 py-px rounded ${
            isGroup ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {isGroup ? '그룹' : (lesson.passName ?? '개인')}
          </span>
        </div>
        <div className="text-xs text-neutral-700 truncate">
          {isGroup
            ? `${lesson.sessionName ?? '세션'} (${lesson.reservedCount ?? 0}/${lesson.capacity ?? '—'})`
            : (lesson.memberName ?? '회원 미정')}
        </div>
        {lesson.roomName && (
          <div className="text-[10px] text-neutral-400 truncate">{lesson.roomName}</div>
        )}
      </button>

      {hoverPos && (
        <div
          className="fixed z-50"
          style={{ left: hoverPos.x, top: hoverPos.y }}
        >
          <LessonHoverCard lesson={lesson} />
        </div>
      )}
    </>
  )
}
