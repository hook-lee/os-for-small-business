/**
 * 강사 정렬 + 색깔 헬퍼.
 *
 * 정렬: role='owner' 가장 왼쪽 → 나머지는 name 오름차순.
 * 색깔: instructors.color (사용자가 강사 추가시 고름). NULL이면 회색 fallback.
 */

export interface InstructorRef {
  id: number
  name: string
  role: 'owner' | 'instructor' | 'admin' | null
  color: string | null
}

/**
 * 원장 우선, 그다음 이름 오름차순.
 * - role==='owner'가 가장 왼쪽 (여러 명이면 이름순)
 * - role==='admin'은 instructor와 동일하게 처리 (실수업은 거의 안 함)
 */
export function sortInstructorsByRoleAndName<T extends InstructorRef>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aOwner = a.role === 'owner' ? 0 : 1
    const bOwner = b.role === 'owner' ? 0 : 1
    if (aOwner !== bOwner) return aOwner - bOwner
    return a.name.localeCompare(b.name, 'ko')
  })
}

/**
 * 강사 색 또는 fallback.
 * NULL/빈 문자열이면 중성적 회색 반환.
 */
export const DEFAULT_INSTRUCTOR_COLOR = '#9ca3af'  // neutral-400

export function instructorColor(color: string | null | undefined): string {
  if (!color || !color.trim()) return DEFAULT_INSTRUCTOR_COLOR
  return color
}
