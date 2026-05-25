import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { fetchPassProductById } from '@/lib/supabase/pass-products'
import { issuePass } from '@/lib/supabase/passes'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: 'Supabase 미설정' }, { status: 503 })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as {
      memberId?: number
      instructorId?: number | null
      productId?: number
      startDate?: string
      paymentAmount?: number
      paymentMethod?: string
      installment?: string
      paymentType?: string
    }
    if (!body.memberId || !body.productId || !body.startDate) {
      return NextResponse.json({ error: 'memberId, productId, startDate 필수' }, { status: 400 })
    }
    const product = await fetchPassProductById(body.productId, ownerId)
    if (!product) return NextResponse.json({ error: '존재하지 않는 상품' }, { status: 404 })
    const id = await issuePass(
      {
        memberId: body.memberId,
        instructorId: body.instructorId ?? null,
        productId: body.productId,
        startDate: body.startDate,
        paymentAmount: body.paymentAmount,
        paymentMethod: body.paymentMethod as '카드' | '계좌이체' | '현금' | undefined,
        installment: body.installment,
        paymentType: body.paymentType as '신규결제' | '재결제' | undefined,
      },
      product,
      ownerId,
    )
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
