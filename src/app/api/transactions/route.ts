import { NextResponse } from 'next/server'
import { loadTransactions, invalidateCache } from '@/lib/data/loader'
import { normalizeCategory, classify } from '@/lib/categories/normalize'
import { insertTransaction } from '@/lib/supabase/transactions'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET() {
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const transactions = await loadTransactions(ownerId)
    return NextResponse.json({ transactions, cachedAt: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: 'Supabase 미설정 — 입력하려면 SUPABASE_URL/SERVICE_ROLE_KEY 필요' }, { status: 503 })
  }
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const body = await req.json() as {
      date?: string; rawCategory?: string; amount?: number; method?: string;
      counterparty?: string; person?: string; memo?: string;
      memberId?: number | null; instructorId?: number | null;
      passProductId?: number | null;
    }
    if (!body.date || !body.rawCategory || typeof body.amount !== 'number' || !body.method) {
      return NextResponse.json({ error: 'date, rawCategory, amount, method 필수' }, { status: 400 })
    }
    const category = normalizeCategory(body.rawCategory)
    if (!category) {
      return NextResponse.json({ error: '유효하지 않은 카테고리' }, { status: 400 })
    }
    if (!['카드', '계좌이체', '현금'].includes(body.method)) {
      return NextResponse.json({ error: '유효하지 않은 수단' }, { status: 400 })
    }
    await insertTransaction({
      date: body.date,
      rawCategory: body.rawCategory,
      category,
      amount: body.amount,
      method: body.method as '카드' | '계좌이체' | '현금',
      counterparty: body.counterparty,
      person: body.person,
      classification: classify(category),
      memo: body.memo,
      memberId: body.memberId ?? null,
      instructorId: body.instructorId ?? null,
      passProductId: body.passProductId ?? null,
    }, ownerId)
    invalidateCache(ownerId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
