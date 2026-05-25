import type { Transaction, Category } from '@/types/domain'
import { classify } from '@/lib/categories/normalize'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { fetchAllTransactions } from '@/lib/supabase/transactions'
import { REAL_TRANSACTIONS } from '../../../tests/fixtures/real-transactions'

interface CacheEntry { value: Transaction[]; expiresAt: number }
const cache = new Map<string, CacheEntry>()
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

/**
 * 거래 내역 로드. owner별 캐시.
 *
 * Fixture fallback 정책:
 * - ownerId='no-auth' (로컬 dev, auth 미설정): fixture로 데모
 * - Supabase 미설정: fixture
 * - 정상 fetch 후 빈 결과 + 'no-auth' 모드: fixture
 *   (로그인된 사용자의 빈 결과는 진짜 빈 결과로 처리 — fixture 노출 방지)
 */
export async function loadTransactions(ownerId: string): Promise<Transaction[]> {
  const key = ownerId
  const entry = cache.get(key)
  if (entry && Date.now() < entry.expiresAt) return entry.value
  let txs: Transaction[]
  if (hasSupabaseConfig()) {
    try {
      txs = await fetchAllTransactions(ownerId)
      if (txs.length === 0 && ownerId === 'no-auth') {
        // 로컬 dev 환경에서만 fixture 데모
        txs = fixtureFallback()
      }
    } catch {
      txs = ownerId === 'no-auth' ? fixtureFallback() : []
    }
  } else {
    // Supabase 미설정 — 모두 fixture (개발 모드)
    txs = fixtureFallback()
  }
  cache.set(key, { value: txs, expiresAt: Date.now() + TTL_MS })
  return txs
}

export function invalidateCache(ownerId?: string): void {
  if (ownerId === undefined) {
    cache.clear()
  } else {
    cache.delete(ownerId)
  }
}
