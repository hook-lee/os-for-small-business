import { getSupabaseClient } from './client'

/** categoryRates 미설정 센터의 기본 카테고리(레거시 4종). */
export const DEFAULT_LESSON_CATEGORIES = ['개인', '재활', '듀엣', '그룹']

/**
 * 센터의 '수업 종류(카테고리)' 목록 — 강사 카테고리별 시급 입력·급여 집계의 카테고리 소스 (§0).
 * 수강권 상위 카테고리(pass_products.category)의 distinct.
 * 비어있으면 레거시 기본값 폴백(라파 등 아직 카테고리 미설정 센터도 4종이 보이게).
 */
export async function fetchLessonCategories(ownerId: string): Promise<string[]> {
  try {
    const supabase = getSupabaseClient()
    let q = supabase.from('pass_products').select('category').eq('active', true)
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data } = await q
    const set = new Set<string>()
    for (const r of (data ?? []) as Array<{ category: string | null }>) {
      const c = (r.category ?? '').trim()
      if (c) set.add(c)
    }
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'ko-KR'))
    return list.length > 0 ? list : DEFAULT_LESSON_CATEGORIES
  } catch {
    return DEFAULT_LESSON_CATEGORIES
  }
}
