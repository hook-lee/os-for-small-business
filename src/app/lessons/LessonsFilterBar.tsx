'use client'

import { useMemo } from 'react'
import type { LessonCategory, TimeBand, ViewMode } from '@/lib/analytics/lessons-view'
import { instructorColor, sortInstructorsByRoleAndName, type InstructorRef } from '@/lib/analytics/instructor-sort'

/**
 * 통합 일정 뷰 상단 필터 컨트롤.
 *  - 카테고리 탭 (전체 / 개별 / 그룹)
 *  - 강사 필터 드롭다운 ('전체 강사' 또는 특정 1명)
 *  - 시간대 토글 (월별 뷰에서만): 전체 / 오전 (≤12:00) / 오후
 *
 * 상태는 부모(UnifiedLessonsView)가 관리. 본 컴포넌트는 controlled.
 */
export function LessonsFilterBar({
  category, onCategoryChange,
  instructors, instructorFilter, onInstructorChange,
  mode, timeBand, onTimeBandChange,
}: {
  category: LessonCategory
  onCategoryChange: (c: LessonCategory) => void

  instructors: InstructorRef[]
  instructorFilter: number | null   // null = 전체
  onInstructorChange: (id: number | null) => void

  mode: ViewMode
  timeBand: TimeBand
  onTimeBandChange: (b: TimeBand) => void
}) {
  const sortedInstructors = useMemo(() => sortInstructorsByRoleAndName(instructors), [instructors])

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 카테고리 탭 */}
      <div className="flex items-center text-sm">
        {(['all', 'individual', 'group'] as LessonCategory[]).map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onCategoryChange(c)}
            className={`inline-flex items-center min-h-[40px] px-3.5 font-medium border-b-2 transition-colors ${
              category === c
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {c === 'all' ? '전체' : c === 'individual' ? '개별 수업' : '그룹 수업'}
          </button>
        ))}
      </div>

      <span className="text-neutral-200">|</span>

      {/* 강사 필터 */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-neutral-500">강사</label>
        <select
          value={instructorFilter ?? ''}
          onChange={e => onInstructorChange(e.target.value ? parseInt(e.target.value, 10) : null)}
          className="text-sm border border-neutral-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">전체 강사</option>
          {sortedInstructors.map(i => (
            <option key={i.id} value={i.id}>
              {i.role === 'owner' ? '⭐ ' : ''}{i.name}
            </option>
          ))}
        </select>
        {instructorFilter && (
          <span
            className="inline-block w-3 h-3 rounded-sm border border-white shadow"
            style={{ backgroundColor: instructorColor(sortedInstructors.find(i => i.id === instructorFilter)?.color ?? null) }}
            title="선택된 강사 색"
          />
        )}
      </div>

      {/* 월별만: 시간대 토글 */}
      {mode === '월별' && (
        <>
          <span className="text-neutral-200">|</span>
          <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
            {(['all', 'am', 'pm'] as TimeBand[]).map(b => (
              <button
                key={b}
                type="button"
                onClick={() => onTimeBandChange(b)}
                className={`inline-flex items-center min-h-[34px] px-3 text-xs font-medium rounded-md transition-colors ${
                  timeBand === b ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {b === 'all' ? '전체' : b === 'am' ? '오전' : '오후'}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-neutral-400">오전 = ≤12:00</span>
        </>
      )}
    </div>
  )
}
