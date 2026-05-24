import { NextResponse } from 'next/server'
import { fetchAllCategories, insertCategory } from '@/lib/supabase/categories'
import { hasSupabaseConfig } from '@/lib/supabase/client'

export async function GET() {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json({ categories: [] })
    }
    const categories = await fetchAllCategories()
    return NextResponse.json({ categories })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  }
  try {
    const body = await req.json() as {
      name?: string
      description?: string | null
      classification?: string
      vatDeductible?: boolean
      incomeTaxDeductible?: boolean
      displayOrder?: number
    }
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: 'name 필수' }, { status: 400 })
    }
    const validClassifications = ['business', 'living', 'owner_draw', 'reserve', 'capital']
    if (body.classification && !validClassifications.includes(body.classification)) {
      return NextResponse.json({ error: 'invalid classification' }, { status: 400 })
    }
    const id = await insertCategory({
      name: body.name.trim(),
      description: body.description ?? null,
      classification: body.classification as 'business' | 'living' | 'owner_draw' | 'reserve' | 'capital' | undefined,
      vatDeductible: body.vatDeductible,
      incomeTaxDeductible: body.incomeTaxDeductible,
      displayOrder: body.displayOrder,
    })
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
