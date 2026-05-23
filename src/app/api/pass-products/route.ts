import { NextResponse } from 'next/server'
import { fetchAllPassProducts, insertPassProduct } from '@/lib/supabase/pass-products'
import { hasSupabaseConfig } from '@/lib/supabase/client'

export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ products: [] })
  try {
    const products = await fetchAllPassProducts()
    return NextResponse.json({ products })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  try {
    const body = await req.json() as {
      name?: string
      passType?: string
      durationDays?: number
      totalCount?: number
      price?: number
      perUnitPrice?: number
      displayOrder?: number
      color?: string
    }
    if (!body.name || !body.passType || typeof body.durationDays !== 'number' || typeof body.totalCount !== 'number' || typeof body.price !== 'number') {
      return NextResponse.json({ error: 'name, passType, durationDays, totalCount, price 필수' }, { status: 400 })
    }
    if (!['프라이빗', '그룹'].includes(body.passType)) {
      return NextResponse.json({ error: '유효하지 않은 passType' }, { status: 400 })
    }
    const id = await insertPassProduct({
      name: body.name,
      passType: body.passType as '프라이빗' | '그룹',
      durationDays: body.durationDays,
      totalCount: body.totalCount,
      price: body.price,
      perUnitPrice: body.perUnitPrice ?? null,
      displayOrder: body.displayOrder ?? 0,
      color: body.color ?? null,
    })
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
