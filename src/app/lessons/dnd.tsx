'use client'

import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { CSSProperties, ReactNode } from 'react'
import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'

/**
 * 수업 카드를 드래그 가능하게 감싸는 래퍼.
 * - id = `${type}-${id}` (활성 뷰 내 유일)
 * - data.lesson 으로 onDragEnd에서 원본 수업을 읽음
 * - 안쪽 카드의 onClick(상세 모달)은 그대로 동작 (센서 activation distance/delay로 클릭과 구분)
 */
export function DraggableLesson({ lesson, children, className }: {
  lesson: UnifiedLesson
  children: ReactNode
  className?: string
}) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: `${lesson.type}-${lesson.id}`,
    data: { lesson },
  })
  const style: CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50, position: 'relative' }
    : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${className ?? ''} ${isDragging ? 'opacity-40' : ''} cursor-grab active:cursor-grabbing`}
    >
      {children}
    </div>
  )
}

/**
 * 하루(요일/날짜 셀)를 드롭 타겟으로. isOver 시 강조 링.
 */
export function DroppableDay({ date, children, className }: {
  date: string
  children: ReactNode
  className?: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${date}`, data: { date } })
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} ${isOver ? 'ring-2 ring-blue-400 ring-inset bg-blue-50/50' : ''}`}
    >
      {children}
    </div>
  )
}
