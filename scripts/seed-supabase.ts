// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-supabase.ts
import { createClient } from '@supabase/supabase-js'
import { REAL_TRANSACTIONS } from '../tests/fixtures/real-transactions'
import { classify, normalizeCategory } from '../src/lib/categories/normalize'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const rows = REAL_TRANSACTIONS.map(t => {
  const category = normalizeCategory(t.category) ?? '기타'
  return {
    date: t.date,
    raw_category: t.category,
    category,
    amount: t.amount,
    method: t.method,
    counterparty: t.counterparty || null,
    person: t.person || null,
    classification: classify(category),
    memo: null,
  }
})

// 배치로 삽입 (500개씩)
const BATCH = 500
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)
  const { error } = await supabase.from('transactions').insert(batch)
  if (error) {
    console.error(`Batch ${i} failed:`, error.message)
    process.exit(1)
  }
  console.log(`Inserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
}
console.log('Seed complete.')
