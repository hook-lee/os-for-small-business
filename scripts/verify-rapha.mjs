import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  const { data: u } = await supabase.auth.admin.listUsers()
  const ownerId = u.users.find(x => x.email === 'raphapilatesyj@gmail.com').id

  // 전체 카운트
  const { count: total } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`총 transactions: ${total}건`)

  // 페이지네이션으로 전체 로드 (Supabase 기본 max 1000)
  const all = []
  for (let from = 0; from < total; from += 1000) {
    const { data } = await supabase
      .from('transactions')
      .select('date, amount')
      .eq('owner_id', ownerId)
      .range(from, from + 999)
    all.push(...(data ?? []))
  }
  console.log(`✓ 로드: ${all.length}건`)

  const byMonth = new Map()
  for (const t of all) {
    const ym = t.date.slice(0, 7)
    if (!byMonth.has(ym)) byMonth.set(ym, { count: 0, rev: 0, exp: 0 })
    const v = byMonth.get(ym)
    v.count++
    if (t.amount > 0) v.rev += t.amount
    else v.exp += Math.abs(t.amount)
  }

  console.log(`\n월별 (${byMonth.size}개월):`)
  for (const m of [...byMonth.keys()].sort()) {
    const v = byMonth.get(m)
    console.log(`  ${m}: ${String(v.count).padStart(3)}건 | 매출 ${v.rev.toLocaleString().padStart(12)}원 | 지출 ${v.exp.toLocaleString().padStart(12)}원`)
  }

  // 총합
  const totalRev = all.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExp = all.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  console.log(`\n총 매출: ${totalRev.toLocaleString()}원`)
  console.log(`총 지출: ${totalExp.toLocaleString()}원`)
}
main().catch(e => { console.error(e); process.exit(1) })
