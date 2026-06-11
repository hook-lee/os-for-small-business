/**
 * 그룹 수업 취소·폐강 기준의 단일 소스 (§0 범용 SaaS — 원장이 운영설정에서 커스텀 가능).
 *
 * - DEFAULT_GROUP_CANCEL_REASONS:   취소 모달에서 고를 수 있는 사유 목록(기본값)
 * - DEFAULT_GROUP_CLOSURE_REASONS:  그 중 '폐강(수요 부족)'으로 집계할 사유(기본값)
 * - DEFAULT_GROUP_CLOSURE_CATEGORIES: 어떤 수업 카테고리를 '그룹수업'(폐강 대상)으로 볼지(기본값)
 *
 * 실제 적용 값은 studio_settings(groupCancelReasons 등)에서 오며, 미설정 시 이 기본값으로 폴백.
 * 코드 곳곳에 '인원 부족'·'그룹' 문자열을 하드코딩하지 말 것 — 반드시 이 모듈/설정을 경유.
 */
export const DEFAULT_GROUP_CANCEL_REASONS: string[] = ['인원 부족', '강사 사정', '시설·기타']
export const DEFAULT_GROUP_CLOSURE_REASONS: string[] = ['인원 부족']
export const DEFAULT_GROUP_CLOSURE_CATEGORIES: string[] = ['그룹']

/** 주어진 취소 사유가 '폐강'으로 집계되는지. closureReasons 미지정 시 기본값 사용. */
export function isClosureReason(reason: string | null | undefined, closureReasons?: string[]): boolean {
  if (reason == null) return false
  return (closureReasons ?? DEFAULT_GROUP_CLOSURE_REASONS).includes(reason)
}
