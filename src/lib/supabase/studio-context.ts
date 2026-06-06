import { getStudioContext, type StudioRole } from './auth-server'

export { getStudioContext } from './auth-server'
export type { StudioContext, StudioRole } from './auth-server'

/**
 * 운동일지 작성자 강사 결정.
 *  - 강사로 로그인 → 작성자는 본인(instructorId)으로 강제 (남의 이름으로 못 씀).
 *  - 원장/admin → 폼에서 고른 강사(requested) 사용.
 */
export async function resolveAuthorInstructorId(requested: number | null): Promise<number | null> {
  const ctx = await getStudioContext()
  if (ctx.role === 'instructor' && ctx.instructorId != null) return ctx.instructorId
  return requested
}

/**
 * 재무 영역(매출·세금·거래·전체 급여·세무설정) 접근 가능 여부.
 * owner/admin만 true. 강사(instructor)는 false → 페이지/메뉴에서 차단.
 */
export function canAccessFinance(role: StudioRole): boolean {
  return role === 'owner' || role === 'admin'
}

/** 강사 계정 관리·운영 설정 등 '관리자' 영역 접근 여부. */
export function isManager(role: StudioRole): boolean {
  return role === 'owner' || role === 'admin'
}
