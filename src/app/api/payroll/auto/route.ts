import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { fetchAutoPayrollCounts } from '@/lib/supabase/payroll-auto'
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
    const counts = await fetchAutoPayrollCounts(instructorId, yearMonth, ownerId)
    return NextResponse.json({ counts })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
