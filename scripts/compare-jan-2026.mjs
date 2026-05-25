import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  const { data } = await supabase.auth.admin.listUsers()
  const user = data.users.find(u => u.email === 'raphapilatesyj@gmail.com')
  const ownerId = user.id

  // 2026-01 전체 + created_at으로 정렬 → 옛 것 vs 새 것 구분
  const { data: txs } = await supabase
    .from('transactions')
    .select('id, date, raw_category, amount, method, memo, created_at')
    .eq('owner_id', ownerId)
    .gte('date', '2026-01-01')
    .lte('date', '2026-01-31')
    .order('created_at', { ascending: true })

  console.log(`총 ${txs.length}건`)

  // created_at별 그룹화
  const groups = {}
  for (const t of txs) {
    const key = t.created_at.slice(0, 16)
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }

  console.log('\ncreated_at 그룹별 row 수:')
  for (const [k, arr] of Object.entries(groups).sort()) {
    console.log(`  ${k}: ${arr.length}건`)
  }

  // 가장 오래된 row 5개 (이전 마이그레이션 추정)
  console.log('\n=== 가장 오래된 row 5개 (이전 마이그레이션) ===')
  txs.slice(0, 5).forEach(t => {
    console.log(`  ${t.date} ${t.raw_category} ${t.amount.toLocaleString()}원 ${t.method} | memo: ${t.memo ?? '—'} | created: ${t.created_at}`)
  })

  // 가장 최근 5개 (방금 업로드)
  console.log('\n=== 가장 최근 row 5개 (방금 업로드) ===')
  txs.slice(-5).forEach(t => {
    console.log(`  ${t.date} ${t.raw_category} ${t.amount.toLocaleString()}원 ${t.method} | memo: ${t.memo ?? '—'} | created: ${t.created_at}`)
  })
}
main()
