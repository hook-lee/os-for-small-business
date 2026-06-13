import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { fetchAutoPayrollBreakdown } from '@/lib/supabase/payroll-auto'
import { fetchInstructorById } from '@/lib/supabase/instructors'
import { fetchRateMapByInstructor } from '@/lib/supabase/member-instructor-rates'
import { computeCategoryPayroll, computeCategoryMemberAdjustment } from '@/lib/analytics/payroll'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ counts: null })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const url = new URL(req.url)
  const instructorIdRaw = url.searchParams.get('instructorId')
  const yearMonth = url.searchParams.get('yearMonth')
  const mode = url.searchParams.get('mode') === 'todate' ? 'todate' : 'full'
  if (!instructorIdRaw || !yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ error: 'instructorId, yearMonth (YYYY-MM) 필수' }, { status: 400 })
  }
  const instructorId = parseInt(instructorIdRaw, 10)
  if (!Number.isFinite(instructorId) || instructorId <= 0) {
    return NextResponse.json({ error: '유효하지 않은 instructorId' }, { status: 400 })
  }
  const today = new Date().toISOString().slice(0, 10)
  try {
    const [{ counts, categoryCounts, byMemberCategory }, instructor, rateMap] = await Promise.all([
      fetchAutoPayrollBreakdown(instructorId, yearMonth, ownerId, mode, today),
      fetchInstructorById(instructorId, ownerId),
      fetchRateMapByInstructor(instructorId, ownerId),
    ])

    // §0 카테고리 기반 급여 + 회원별 시급/인센티브 조정 (강사 시급 정보 필요)
    let adjustment = 0
    let lines: ReturnType<typeof computeCategoryMemberAdjustment>['lines'] = []
    let naiveGross = 0
    let byCategory: Record<string, number> = {}
    if (instructor) {
      const r = computeCategoryPayroll(instructor, categoryCounts)
      naiveGross = r.grossTotal
      byCategory = r.byCategory
      const res = computeCategoryMemberAdjustment(instructor, byMemberCategory, rateMap)
      adjustment = res.adjustment
      lines = res.lines
    }

    return NextResponse.json({
      counts,                  // 레거시 4종 카운트 (하위호환 표시용)
      categoryCounts,          // 카테고리별 횟수
      byCategory,              // 카테고리별 금액 (시급 적용 후)
      adjustment,
      naiveGross,
      gross: naiveGross + adjustment,
      lines,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
