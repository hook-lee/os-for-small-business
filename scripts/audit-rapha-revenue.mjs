import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  const { data: u } = await supabase.auth.admin.listUsers()
  const ownerId = u.users.find(x => x.email === 'raphapilatesyj@gmail.com').id

  // 1. DB 전체 라파 owner의 매출 (amount > 0) 총 카운트 + 합계
  const { data: allRevenue } = await supabase
    .from('transactions')
    .select('date, raw_category, amount, memo, created_at')
    .eq('owner_id', ownerId)
    .gt('amount', 0)
    .order('date', { ascending: true })

  console.log(`=== 라파 owner의 전체 매출 row ===`)
  console.log(`총 ${allRevenue.length}건, 합계 ${allRevenue.reduce((s, t) => s + t.amount, 0).toLocaleString()}원`)

  // 월별
  const byMonth = {}
  for (const t of allRevenue) {
    const ym = t.date.slice(0, 7)
    if (!byMonth[ym]) byMonth[ym] = { count: 0, sum: 0 }
    byMonth[ym].count++
    byMonth[ym].sum += t.amount
  }
  console.log('\n월별 매출:')
  for (const m of Object.keys(byMonth).sort()) {
    console.log(`  ${m}: ${byMonth[m].count}건 / ${byMonth[m].sum.toLocaleString()}원`)
  }

  // 2. 사용자가 준 xlsx의 진짜 매출
  const raw = JSON.parse(readFileSync('scripts/2026-h1-extracted.json', 'utf8'))
  const xlsxRevenue = raw.filter(r => r.amount > 0)
  console.log(`\n=== 사용자 xlsx의 진짜 매출 ===`)
  console.log(`총 ${xlsxRevenue.length}건, 합계 ${xlsxRevenue.reduce((s, t) => s + t.amount, 0).toLocaleString()}원`)
  const xByMonth = {}
  for (const t of xlsxRevenue) {
    const ym = t.date.slice(0, 7)
    if (!xByMonth[ym]) xByMonth[ym] = { count: 0, sum: 0 }
    xByMonth[ym].count++
    xByMonth[ym].sum += t.amount
  }
  console.log('월별:')
  for (const m of Object.keys(xByMonth).sort()) {
    console.log(`  ${m}: ${xByMonth[m].count}건 / ${xByMonth[m].sum.toLocaleString()}원`)
  }

  // 3. 2026 H1만 비교
  const db2026 = allRevenue.filter(t => t.date >= '2026-01-01' && t.date <= '2026-05-31')
  console.log(`\n=== 2026-01~05 비교 ===`)
  console.log(`DB: ${db2026.length}건 / ${db2026.reduce((s, t) => s + t.amount, 0).toLocaleString()}원`)
  console.log(`xlsx: ${xlsxRevenue.length}건 / ${xlsxRevenue.reduce((s, t) => s + t.amount, 0).toLocaleString()}원`)
  console.log(`차이: DB - xlsx = ${db2026.length - xlsxRevenue.length}건 / ${(db2026.reduce((s, t) => s + t.amount, 0) - xlsxRevenue.reduce((s, t) => s + t.amount, 0)).toLocaleString()}원`)

  // 4. 2026 H1 DB 매출의 created_at 분포 (어떤 source에서 들어왔나)
  console.log(`\n=== 2026 H1 매출 created_at 그룹 ===`)
  const groups = {}
  for (const t of db2026) {
    const k = t.created_at.slice(0, 16)
    if (!groups[k]) groups[k] = []
    groups[k].push(t)
  }
  for (const [k, arr] of Object.entries(groups).sort()) {
    const sum = arr.reduce((s, t) => s + t.amount, 0)
    console.log(`  ${k}: ${arr.length}건 / ${sum.toLocaleString()}원`)
    console.log(`    샘플: ${arr.slice(0, 2).map(t => `${t.date} ${t.raw_category} ${t.amount.toLocaleString()}원 memo:${t.memo ?? '—'}`).join(' | ')}`)
  }

  // 5. transactions의 매출 vs passes 테이블 비교 — 수강권 결제가 transactions에도 들어갔는지
  const { count: passCount } = await supabase
    .from('passes')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`\n=== passes 테이블 ===`)
  console.log(`라파 owner의 passes: ${passCount}건`)
}
main().catch(e => { console.error(e); process.exit(1) })
