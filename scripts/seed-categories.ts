// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-categories.ts
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_CATEGORIES_RAW } from '../src/lib/categories/defaults'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    process.exit(1)
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } })
  console.log(`Seeding ${DEFAULT_CATEGORIES_RAW.length} categories...`)

  const { data: existing } = await supabase.from('expense_categories').select('name')
  const existingNames = new Set((existing ?? []).map((c: { name: string }) => c.name))

  const toInsert = DEFAULT_CATEGORIES_RAW
    .filter(c => !existingNames.has(c.name))
    .map(c => ({
      name: c.name,
      description: c.description,
      classification: c.classification,
      vat_deductible: c.vatDeductible,
      income_tax_deductible: c.incomeTaxDeductible,
      display_order: c.displayOrder,
      is_default: true,
      active: true,
    }))
  if (toInsert.length === 0) {
    console.log('All categories already exist.')
    return
  }
  console.log(`Inserting ${toInsert.length} new categories...`)
  const { error } = await supabase.from('expense_categories').insert(toInsert)
  if (error) { console.error('Insert failed:', error.message); process.exit(1) }
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
