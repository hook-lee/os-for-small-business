import { NextResponse } from 'next/server'
import { updateCategory, deleteCategory } from '@/lib/supabase/categories'
import { hasSupabaseConfig } from '@/lib/supabase/client'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  }
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
    const body = await req.json() as {
      name?: string
      description?: string | null
      classification?: string
      vatDeductible?: boolean
      incomeTaxDeductible?: boolean
      displayOrder?: number
      active?: boolean
    }
    const validClassifications = ['business', 'living', 'owner_draw', 'reserve', 'capital']
    if (body.classification && !validClassifications.includes(body.classification)) {
      return NextResponse.json({ error: 'invalid classification' }, { status: 400 })
    }
    await updateCategory(id, {
      name: body.name,
      description: body.description,
      classification: body.classification as 'business' | 'living' | 'owner_draw' | 'reserve' | 'capital' | undefined,
      vatDeductible: body.vatDeductible,
      incomeTaxDeductible: body.incomeTaxDeductible,
      displayOrder: body.displayOrder,
      active: body.active,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  }
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
    await deleteCategory(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
