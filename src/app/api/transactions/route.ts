import { NextResponse } from 'next/server'
import { fetchSheetRows, getSheetConfig } from '@/lib/sheets/client'
import { parseSheetRows } from '@/lib/sheets/parser'
import { createCache } from '@/lib/sheets/cache'

const transactionsCache = createCache({
  ttlMs: 5 * 60 * 1000,
  fetcher: async () => {
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
