// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-pass-products.ts
// 12개 카탈로그 상품 upsert (idempotent by name+duration_days+total_count)
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

const CATALOG: Array<{
  name: string
  pass_type: '프라이빗' | '그룹'
  duration_days: number
  total_count: number
  price: number
  per_unit_price: number
  display_order: number
  color: string
}> = [
  { name: '듀엣', pass_type: '프라이빗', duration_days: 135, total_count: 30, price: 2310000, per_unit_price: 77000, display_order: 1, color: '#6366f1' },
  { name: '재활', pass_type: '프라이빗', duration_days: 90,  total_count: 20, price: 1540000, per_unit_price: 77000, display_order: 2, color: '#ec4899' },
  { name: '개인', pass_type: '프라이빗', duration_days: 135, total_count: 30, price: 1950000, per_unit_price: 65000, display_order: 3, color: '#a855f7' },
  { name: '재활', pass_type: '프라이빗', duration_days: 45,  total_count: 10, price: 770000,  per_unit_price: 77000, display_order: 4, color: '#f43f5e' },
  { name: '듀엣 체험', pass_type: '프라이빗', duration_days: 1, total_count: 1, price: 40000, per_unit_price: 40000, display_order: 5, color: '#10b981' },
  { name: '체험', pass_type: '프라이빗', duration_days: 1, total_count: 1, price: 30000, per_unit_price: 30000, display_order: 6, color: '#14b8a6' },
  { name: '듀엣', pass_type: '프라이빗', duration_days: 90, total_count: 20, price: 1540000, per_unit_price: 77000, display_order: 7, color: '#06b6d4' },
  { name: '듀엣', pass_type: '프라이빗', duration_days: 45, total_count: 10, price: 770000, per_unit_price: 77000, display_order: 8, color: '#0ea5e9' },
  { name: '개인', pass_type: '프라이빗', duration_days: 90, total_count: 20, price: 1300000, per_unit_price: 65000, display_order: 9, color: '#d946ef' },
  { name: '개인', pass_type: '프라이빗', duration_days: 45, total_count: 10, price: 650000, per_unit_price: 65000, display_order: 10, color: '#c084fc' },
  { name: '2:1 소그룹', pass_type: '그룹', duration_days: 90, total_count: 20, price: 660000, per_unit_price: 33000, display_order: 11, color: '#4d7c0f' },
  { name: '2:1 소그룹', pass_type: '그룹', duration_days: 45, total_count: 10, price: 290000, per_unit_price: 29000, display_order: 12, color: '#f97316' },
]

async function main() {
  console.log(`Seeding ${CATALOG.length} pass products...`)
  const { data: existing } = await supabase
    .from('pass_products')
    .select('id, name, duration_days, total_count')
    .eq('active', true)
  const existingKeys = new Set(
    (existing ?? []).map(
      (p: { name: string; duration_days: number; total_count: number }) =>
        `${p.name}|${p.duration_days}|${p.total_count}`
    )
  )

  const toInsert = CATALOG.filter(
    p => !existingKeys.has(`${p.name}|${p.duration_days}|${p.total_count}`)
  )
  if (toInsert.length === 0) {
    console.log('All catalog items already exist.')
    return
  }
  console.log(`Inserting ${toInsert.length} new products...`)
  const { error } = await supabase.from('pass_products').insert(toInsert)
  if (error) {
    console.error('Insert failed:', error.message)
    process.exit(1)
  }
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
