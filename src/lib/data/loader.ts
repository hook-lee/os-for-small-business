import type { Transaction, Category } from '@/types/domain'
import { classify } from '@/lib/categories/normalize'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { fetchAllTransactions } from '@/lib/supabase/transactions'
import { REAL_TRANSACTIONS } from '../../../tests/fixtures/real-transactions'

let cached: { value: Transaction[]; expiresAt: number } | null = null
const TTL_MS = 60 * 1000  // 1분 (입력 후 빨리 반영)

function fixtureFallback(): Transaction[] {
  return REAL_TRANSACTIONS.map(t => ({
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

export async function loadTransactions(): Promise<Transaction[]> {
  if (cached && Date.now() < cached.expiresAt) return cached.value
  let txs: Transaction[]
  if (hasSupabaseConfig()) {
    try {
      txs = await fetchAllTransactions()
      if (txs.length === 0) txs = fixtureFallback()  // 빈 DB면 fixture로 데모
    } catch {
      txs = fixtureFallback()
    }
  } else {
    txs = fixtureFallback()
  }
  cached = { value: txs, expiresAt: Date.now() + TTL_MS }
  return txs
}

export function invalidateCache(): void {
  cached = null
}
