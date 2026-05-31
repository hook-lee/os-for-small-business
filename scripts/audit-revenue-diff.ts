/**
 * 라파 transactions(가계부) vs passes(회원 결제) 매출 차이 진단.
 *
 * Usage:
 *   npm run audit:revenue-diff [-- --year=2026 --month=05]
 *
 * 정책:
 *  - transactions: classification='business' AND category='매출'  (매출 source of truth)
 *  - passes: payment_amount 합 (회원 결제 자동 기록)
 *
 *  두 source 매칭 알고리즘:
 *   1. 같은 owner_id 한정
 *   2. 같은 날짜 (±3일 within window) + 같은 amount → 매칭
 *   3. 결제수단(card/transfer/cash) 일치하면 신뢰도 ↑
 *
 *  출력:
 *   - 월별 요약: transactions 합 vs passes 합 vs 차이
 *   - 미매칭 transactions (transactions에 있으나 passes에 없음 — 외부 매출 or 가계부 오분류)
 *   - 미매칭 passes (passes에 있으나 transactions에 없음 — 가계부 누락 의심)
 *   - 자동으로 transactions에 INSERT는 안 함 (dry-run 전용 진단)
 */
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ path: '.env.local' })
dotenvConfig()

import { createClient } from '@supabase/supabase-js'

const RAPHA_EMAIL = 'raphapilatesyj@gmail.com'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// ─────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const a = args.find(x => x.startsWith(flag + '='))
    return a ? a.slice(flag.length + 1) : null
  }
  return {
    year: get('--year'),
    month: get('--month'),
  }
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface TxRow {
  id: number
  date: string         // YYYY-MM-DD
  amount: number
  method: string | null
  counterparty: string | null
  person: string | null
}

interface PassRow {
  id: number
  paid_at: string      // YYYY-MM-DD
  payment_amount: number
  payment_method: string | null
  pass_name: string
  member_id: number
  member_name?: string
}

interface MatchResult {
  matched: Array<{ tx: TxRow; pass: PassRow; dateDiff: number }>
  unmatchedTxs: TxRow[]
  unmatchedPasses: PassRow[]
}

// ─────────────────────────────────────────────
// 매칭 알고리즘
//  1. 같은 날 + 같은 amount → 우선
//  2. ±3일 + 같은 amount → fallback
//  3. 한 거래는 한 번만 매칭
// ─────────────────────────────────────────────
function matchTxsAndPasses(txs: TxRow[], passes: PassRow[]): MatchResult {
  const matched: MatchResult['matched'] = []
  const usedTxIds = new Set<number>()
  const usedPassIds = new Set<number>()

  // 1단계: 같은 날 + 같은 amount
  for (const t of txs) {
    if (usedTxIds.has(t.id)) continue
    const p = passes.find(p =>
      !usedPassIds.has(p.id) &&
      p.paid_at === t.date &&
      p.payment_amount === t.amount,
    )
    if (p) {
      matched.push({ tx: t, pass: p, dateDiff: 0 })
      usedTxIds.add(t.id)
      usedPassIds.add(p.id)
    }
  }

  // 2단계: ±3일 + 같은 amount
  for (const t of txs) {
    if (usedTxIds.has(t.id)) continue
    const tDate = new Date(t.date).getTime()
    const candidates = passes
      .filter(p => !usedPassIds.has(p.id) && p.payment_amount === t.amount)
      .map(p => ({ p, diff: Math.abs(new Date(p.paid_at).getTime() - tDate) / 86_400_000 }))
      .filter(x => x.diff <= 3)
      .sort((a, b) => a.diff - b.diff)
    if (candidates.length > 0) {
      const { p, diff } = candidates[0]
      matched.push({ tx: t, pass: p, dateDiff: diff })
      usedTxIds.add(t.id)
      usedPassIds.add(p.id)
    }
  }

  return {
    matched,
    unmatchedTxs: txs.filter(t => !usedTxIds.has(t.id)),
    unmatchedPasses: passes.filter(p => !usedPassIds.has(p.id)),
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function lookupOwnerId(): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) throw new Error(`auth users 조회 실패: ${error.message}`)
  const u = data.users.find(u => u.email === RAPHA_EMAIL)
  if (!u) throw new Error(`라파 계정 (${RAPHA_EMAIL}) 못 찾음`)
  return u.id
}

async function fetchTxs(ownerId: string, year: string | null, month: string | null): Promise<TxRow[]> {
  let q = supabase
    .from('transactions')
    .select('id, date, amount, method, counterparty, person, category')
    .eq('owner_id', ownerId)
    .eq('category', '매출')
    .order('date', { ascending: true })
  if (year && month) {
    q = q.gte('date', `${year}-${month.padStart(2, '0')}-01`)
         .lte('date', `${year}-${month.padStart(2, '0')}-31`)
  } else if (year) {
    q = q.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
  }
  const { data, error } = await q
  if (error) throw new Error(`transactions 조회 실패: ${error.message}`)
  return (data ?? []) as TxRow[]
}

async function fetchPasses(ownerId: string, year: string | null, month: string | null): Promise<PassRow[]> {
  let q = supabase
    .from('passes')
    .select('id, paid_at, payment_amount, payment_method, pass_name, member_id, members(name)')
    .eq('owner_id', ownerId)
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: true })
  if (year && month) {
    q = q.gte('paid_at', `${year}-${month.padStart(2, '0')}-01`)
         .lte('paid_at', `${year}-${month.padStart(2, '0')}-31`)
  } else if (year) {
    q = q.gte('paid_at', `${year}-01-01`).lte('paid_at', `${year}-12-31`)
  }
  const { data, error } = await q
  if (error) throw new Error(`passes 조회 실패: ${error.message}`)
  return ((data ?? []) as Array<PassRow & { members: { name: string } | { name: string }[] | null }>)
    .map(r => ({
      ...r,
      member_name: Array.isArray(r.members) ? r.members[0]?.name : r.members?.name,
    }))
}

function ym(date: string): string {
  return date.slice(0, 7)
}

interface MonthlyStat {
  yearMonth: string
  txCount: number
  txTotal: number
  passCount: number
  passTotal: number
  matchedCount: number
  matchedAmount: number
  unmatchedTxs: TxRow[]
  unmatchedPasses: PassRow[]
}

function aggregateMonthly(txs: TxRow[], passes: PassRow[], match: MatchResult): MonthlyStat[] {
  const map = new Map<string, MonthlyStat>()
  function get(key: string): MonthlyStat {
    if (!map.has(key)) map.set(key, {
      yearMonth: key,
      txCount: 0, txTotal: 0,
      passCount: 0, passTotal: 0,
      matchedCount: 0, matchedAmount: 0,
      unmatchedTxs: [], unmatchedPasses: [],
    })
    return map.get(key)!
  }
  for (const t of txs) {
    const s = get(ym(t.date))
    s.txCount++; s.txTotal += t.amount
  }
  for (const p of passes) {
    const s = get(ym(p.paid_at))
    s.passCount++; s.passTotal += p.payment_amount
  }
  for (const m of match.matched) {
    const s = get(ym(m.tx.date))
    s.matchedCount++; s.matchedAmount += m.tx.amount
  }
  for (const t of match.unmatchedTxs) {
    const s = get(ym(t.date))
    s.unmatchedTxs.push(t)
  }
  for (const p of match.unmatchedPasses) {
    const s = get(ym(p.paid_at))
    s.unmatchedPasses.push(p)
  }
  return [...map.values()].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
}

async function main() {
  const args = parseArgs()
  console.log('\n📊 매출 데이터 진단 (transactions vs passes)\n')
  if (args.year && args.month) console.log(`범위: ${args.year}-${args.month}`)
  else if (args.year) console.log(`범위: ${args.year} 전체`)
  else console.log('범위: 전체 기간')
  console.log()

  const ownerId = await lookupOwnerId()
  console.log(`라파 owner_id = ${ownerId}\n`)

  const [txs, passes] = await Promise.all([
    fetchTxs(ownerId, args.year, args.month),
    fetchPasses(ownerId, args.year, args.month),
  ])

  console.log(`📂 transactions (매출 카테고리): ${txs.length}건, ${txs.reduce((s, t) => s + t.amount, 0).toLocaleString()}원`)
  console.log(`📂 passes (회원 결제):          ${passes.length}건, ${passes.reduce((s, p) => s + p.payment_amount, 0).toLocaleString()}원`)
  console.log()

  const match = matchTxsAndPasses(txs, passes)
  const monthly = aggregateMonthly(txs, passes, match)

  console.log('='.repeat(100))
  console.log('📅 월별 요약')
  console.log('='.repeat(100))
  console.log(`${'월'.padEnd(10)} ${'TX건수'.padStart(8)} ${'TX합계'.padStart(13)} ${'결제건수'.padStart(8)} ${'결제합계'.padStart(13)} ${'차이'.padStart(13)} ${'매칭'.padStart(8)} ${'TX누락'.padStart(8)} ${'결제누락'.padStart(8)}`)
  console.log('-'.repeat(100))
  let totalDiff = 0
  let totalTx = 0, totalPass = 0
  for (const m of monthly) {
    const diff = m.passTotal - m.txTotal
    totalDiff += diff
    totalTx += m.txTotal
    totalPass += m.passTotal
    const diffStr = diff === 0 ? '·' : (diff > 0 ? '+' : '') + diff.toLocaleString()
    const flag = Math.abs(diff) > 100_000 ? ' ⚠️' : ''
    console.log(
      `${m.yearMonth.padEnd(10)} ${String(m.txCount).padStart(8)} ${m.txTotal.toLocaleString().padStart(13)} ${String(m.passCount).padStart(8)} ${m.passTotal.toLocaleString().padStart(13)} ${diffStr.padStart(13)} ${String(m.matchedCount).padStart(8)} ${String(m.unmatchedTxs.length).padStart(8)} ${String(m.unmatchedPasses.length).padStart(8)}${flag}`,
    )
  }
  console.log('-'.repeat(100))
  console.log(`${'합계'.padEnd(10)} ${String(txs.length).padStart(8)} ${totalTx.toLocaleString().padStart(13)} ${String(passes.length).padStart(8)} ${totalPass.toLocaleString().padStart(13)} ${(totalDiff > 0 ? '+' : '') + totalDiff.toLocaleString().padStart(13)}`)

  console.log()
  console.log('='.repeat(100))
  console.log(`📌 매칭 결과 — ${match.matched.length}건 매칭 / ${match.unmatchedTxs.length}건 TX 단독 / ${match.unmatchedPasses.length}건 결제 단독`)
  console.log('='.repeat(100))

  // 차이가 큰 월 detail
  const problemMonths = monthly.filter(m => Math.abs(m.passTotal - m.txTotal) > 50_000)
  if (problemMonths.length > 0) {
    console.log(`\n⚠️  차이 큰 월 (>50,000원) 상세:\n`)
    for (const m of problemMonths.slice(0, 10)) {
      console.log(`── ${m.yearMonth} ── 차이 ${(m.passTotal - m.txTotal).toLocaleString()}원`)
      if (m.unmatchedPasses.length > 0) {
        console.log(`  💸 결제 있으나 가계부 누락:`)
        for (const p of m.unmatchedPasses.slice(0, 8)) {
          console.log(`     ${p.paid_at}  ${p.payment_amount.toLocaleString().padStart(10)}원  ${p.payment_method ?? '?'}  · ${p.pass_name} (${p.member_name ?? '?'})`)
        }
        if (m.unmatchedPasses.length > 8) console.log(`     ... 외 ${m.unmatchedPasses.length - 8}건`)
      }
      if (m.unmatchedTxs.length > 0) {
        console.log(`  📒 가계부 있으나 결제 없음 (외부 매출 또는 분류 오류):`)
        for (const t of m.unmatchedTxs.slice(0, 8)) {
          console.log(`     ${t.date}  ${t.amount.toLocaleString().padStart(10)}원  ${t.method ?? '?'}  · ${t.counterparty ?? '-'} / ${t.person ?? '-'}`)
        }
        if (m.unmatchedTxs.length > 8) console.log(`     ... 외 ${m.unmatchedTxs.length - 8}건`)
      }
      console.log()
    }
    if (problemMonths.length > 10) console.log(`... 외 ${problemMonths.length - 10}개월\n`)
  }

  // 패턴 분석
  console.log('='.repeat(100))
  console.log('🔍 패턴 분석')
  console.log('='.repeat(100))

  // 미매칭 passes — 결제수단 분포
  const passByMethod = new Map<string, { count: number; total: number }>()
  for (const p of match.unmatchedPasses) {
    const k = p.payment_method ?? '미상'
    if (!passByMethod.has(k)) passByMethod.set(k, { count: 0, total: 0 })
    passByMethod.get(k)!.count++
    passByMethod.get(k)!.total += p.payment_amount
  }
  if (passByMethod.size > 0) {
    console.log('\n결제는 있으나 가계부 누락 — 결제수단별 분포:')
    for (const [m, s] of [...passByMethod.entries()].sort((a, b) => b[1].total - a[1].total)) {
      console.log(`  ${m.padEnd(10)} ${s.count}건  ${s.total.toLocaleString()}원`)
    }
  }

  // 미매칭 transactions — 카테고리는 모두 '매출'이라 의미 X. 대신 결제수단별
  const txByMethod = new Map<string, { count: number; total: number }>()
  for (const t of match.unmatchedTxs) {
    const k = t.method ?? '미상'
    if (!txByMethod.has(k)) txByMethod.set(k, { count: 0, total: 0 })
    txByMethod.get(k)!.count++
    txByMethod.get(k)!.total += t.amount
  }
  if (txByMethod.size > 0) {
    console.log('\n가계부 매출 있으나 결제 없음 — 결제수단별 분포:')
    for (const [m, s] of [...txByMethod.entries()].sort((a, b) => b[1].total - a[1].total)) {
      console.log(`  ${m.padEnd(10)} ${s.count}건  ${s.total.toLocaleString()}원`)
    }
  }

  console.log('\n✅ 진단 완료. DB 변경 없음 (dry-run).\n')
}

main().catch(err => {
  console.error('💥 실패:', err)
  process.exit(1)
})
