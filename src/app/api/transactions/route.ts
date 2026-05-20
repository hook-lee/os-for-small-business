import { NextResponse } from 'next/server'
import { fetchSheetRows, getSheetConfig } from '@/lib/sheets/client'
import { parseSheetRows } from '@/lib/sheets/parser'
import { createCache } from '@/lib/sheets/cache'
import { normalizeCategory, classify } from '@/lib/categories/normalize'
import type { Transaction } from '@/types/domain'

function hasSheetConfig(): boolean {
  return !!(
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
    process.env.GOOGLE_SHEETS_PRIVATE_KEY &&
    process.env.GOOGLE_SHEETS_ID
  )
}

async function loadFixtureFallback(): Promise<Transaction[]> {
  const { REAL_TRANSACTIONS } = await import('../../../../tests/fixtures/real-transactions')
  return REAL_TRANSACTIONS.map(r => {
    const category = normalizeCategory(r.category) ?? '기타'
    return {
      date: r.date,
      rawCategory: r.category,
      category,
      amount: r.amount,
      method: r.method,
      counterparty: r.counterparty || undefined,
      person: r.person || undefined,
      classification: classify(category),
      memo: undefined,
    } satisfies Transaction
  })
}

const transactionsCache = createCache({
  ttlMs: 5 * 60 * 1000,
  fetcher: async () => {
    if (!hasSheetConfig()) {
      return loadFixtureFallback()
    }
    const config = getSheetConfig()
    const rows = await fetchSheetRows(config)
    return parseSheetRows(rows)
  },
})

export async function GET() {
  try {
    const transactions = await transactionsCache.get()
    return NextResponse.json({ transactions, cachedAt: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  transactionsCache.invalidate()
  return NextResponse.json({ ok: true })
}
