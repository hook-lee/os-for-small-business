import { NextResponse } from 'next/server'
import { fetchPayrollByMonth, upsertPayroll, type UpsertPayrollInput } from '@/lib/supabase/payroll'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ records: [] })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const url = new URL(req.url)
    const yearMonth = url.searchParams.get('yearMonth')
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      return NextResponse.json({ error: 'yearMonth (YYYY-MM) 필수' }, { status: 400 })
    }
    const records = await fetchPayrollByMonth(yearMonth, ownerId)
    return NextResponse.json({ records })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as UpsertPayrollInput
    if (!body.instructorId || !body.yearMonth) {
      return NextResponse.json({ error: 'instructorId, yearMonth 필수' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}$/.test(body.yearMonth)) {
      return NextResponse.json({ error: 'yearMonth 형식 YYYY-MM' }, { status: 400 })
    }
    await upsertPayroll(body, ownerId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
