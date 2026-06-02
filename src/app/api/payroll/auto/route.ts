import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { fetchAutoPayrollBreakdown } from '@/lib/supabase/payroll-auto'
import { fetchInstructorById } from '@/lib/supabase/instructors'
import { fetchRateMapByInstructor } from '@/lib/supabase/member-instructor-rates'
import { computePayrollTotal, computeMemberRateAdjustment } from '@/lib/analytics/payroll'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ counts: null })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const url = new URL(req.url)
  const instructorIdRaw = url.searchParams.get('instructorId')
  const yearMonth = url.searchParams.get('yearMonth')
  if (!instructorIdRaw || !yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ error: 'instructorId, yearMonth (YYYY-MM) 필수' }, { status: 400 })
  }
  const instructorId = parseInt(instructorIdRaw, 10)
  if (!Number.isFinite(instructorId) || instructorId <= 0) {
    return NextResponse.json({ error: '유효하지 않은 instructorId' }, { status: 400 })
  }
  try {
    const [{ counts, byMember }, instructor, rateMap] = await Promise.all([
      fetchAutoPayrollBreakdown(instructorId, yearMonth, ownerId),
      fetchInstructorById(instructorId, ownerId),
      fetchRateMapByInstructor(instructorId, ownerId),
    ])

    // 회원별 시급/인센티브 조정 (강사 시급 정보 필요)
    let adjustment = 0
    let lines: ReturnType<typeof computeMemberRateAdjustment>['lines'] = []
    let naiveGross = 0
    if (instructor) {
      naiveGross = computePayrollTotal(instructor, counts).grossTotal
      const res = computeMemberRateAdjustment(instructor, byMember, rateMap)
      adjustment = res.adjustment
      lines = res.lines
    }

    return NextResponse.json({
      counts,
      adjustment,
      naiveGross,
      gross: naiveGross + adjustment,
      lines,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
