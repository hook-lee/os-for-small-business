import type { Transaction, Category } from '@/types/domain'
import { fetchSheetRows, getSheetConfig } from '@/lib/sheets/client'
import { parseSheetRows } from '@/lib/sheets/parser'
import { classify } from '@/lib/categories/normalize'
import { REAL_TRANSACTIONS } from '../../../tests/fixtures/real-transactions'

let cached: { value: Transaction[]; expiresAt: number } | null = null
const TTL_MS = 5 * 60 * 1000

export async function loadTransactions(): Promise<Transaction[]> {
  if (cached && Date.now() < cached.expiresAt) return cached.value
  let txs: Transaction[]
  try {
    const config = getSheetConfig()
    const rows = await fetchSheetRows(config)
    txs = parseSheetRows(rows)
    if (txs.length === 0) throw new Error('no rows from sheet, falling back')
  } catch {
    // Fallback to fixture (라파 실데이터 2539 건)
    txs = REAL_TRANSACTIONS.map(t => ({
      date: t.date,
      rawCategory: t.category,
      category: t.category as Category,
      amount: t.amount,
      method: t.method,
      counterparty: t.counterparty || undefined,
      person: t.person || undefined,
      classification: classify(t.category as Category),
      memo: undefined,
    })) as Transaction[]
  }
  cached = { value: txs, expiresAt: Date.now() + TTL_MS }
  return txs
}
