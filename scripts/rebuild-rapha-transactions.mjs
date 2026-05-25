/**
 * 라파 owner의 transactions 전체 삭제 + 사용자가 준 xlsx 523건만 재 insert.
 *
 * 절대 건드리지 않는 테이블: members, instructors, passes, pass_products,
 * lessons, group_sessions, group_reservations, payroll_records, expense_categories,
 * message_records, chat_sessions, chat_messages, pass_adjustments, profile
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const TARGET_EMAIL = 'raphapilatesyj@gmail.com'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ───────── 카테고리 normalize (이전 스크립트와 동일) ─────────
const NORMALIZATION_MAP = {
  '임차료': '임대료', '소모품비': '소모품', '소모푸': '소모품', '마케팅': '마케팅비',
  '월급': '급여', '유진급여': '유진 급여', '의류': '의류비', '교육': '교육비',
  '인쇄비': '도서인쇄비', '프린트': '도서인쇄비', '보혐료': '보험료',
  '경좃비': '경조사비', '경조선물비': '경조사비', '간식': '식비', '약': '의료비',
  '운송비': '수수료', '정기': '정기결제', '복지': '복리후생비',
}
const STANDARD_CATEGORIES = new Set([
  '매출', '임대료', '식비', '마케팅비', '교육비', '정기결제', '세금',
  '소모품', '보험료', '품위유지비', '교통비', '의류비', '의료비',
  '소품', '도서인쇄비', '경조사비', '수수료', '공과금', '관리비',
  '급여', '유진 급여', '예비비', '사무용품', '자산', '보통예금',
  '복리후생비', '지급수수료', '세탁비', '연금', '적금',
])
function normalizeCategory(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  if (NORMALIZATION_MAP[t]) return NORMALIZATION_MAP[t]
  if (STANDARD_CATEGORIES.has(t)) return t
  return '기타'
}
const OWNER_DRAW = new Set(['유진 급여'])
const RESERVE = new Set(['예비비'])
const CAPITAL = new Set(['자산', '보통예금', '사무용품'])
const BUSINESS = new Set(['매출', '임대료', '마케팅비', '정기결제', '세금', '보험료', '공과금',
  '관리비', '수수료', '교육비', '경조사비', '급여', '복리후생비', '지급수수료', '연금', '적금', '세탁비'])
function classify(cat) {
  if (OWNER_DRAW.has(cat)) return 'owner_draw'
  if (RESERVE.has(cat)) return 'reserve'
  if (CAPITAL.has(cat)) return 'capital'
  if (BUSINESS.has(cat)) return 'business'
  return 'living'
}
function normalizeMethod(m) {
  if (!m) return '카드'
  const t = String(m).trim()
  if (['카드', '계좌이체', '현금'].includes(t)) return t
  return '카드'  // 네이버페이 등 → 카드
}

async function main() {
  // 1. owner_id 확인
  const { data: u } = await supabase.auth.admin.listUsers()
  const user = u.users.find(x => x.email === TARGET_EMAIL)
  if (!user) { console.error(`❌ ${TARGET_EMAIL} 계정 없음`); process.exit(1) }
  const ownerId = user.id
  console.log(`✓ owner_id: ${ownerId}`)

  // 2. 삭제 전 카운트 (보고용)
  const { count: beforeCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`\n현재 라파 transactions: ${beforeCount}건`)

  // 라파 매출 합계 (전체)
  const { data: revRows } = await supabase
    .from('transactions')
    .select('amount')
    .eq('owner_id', ownerId)
    .gt('amount', 0)
  const totalRevenue = (revRows ?? []).reduce((s, t) => s + t.amount, 0)
  console.log(`총 매출 (전체 기간): ${totalRevenue.toLocaleString()}원`)

  // 3. 전체 삭제
  console.log(`\n⚠ 라파 owner의 transactions 전체 삭제...`)
  const { error: delErr } = await supabase
    .from('transactions')
    .delete()
    .eq('owner_id', ownerId)
  if (delErr) { console.error('삭제 실패:', delErr.message); process.exit(1) }

  const { count: afterDelete } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`✓ 삭제 완료. 라파 transactions: ${afterDelete}건 (0이어야 함)`)

  // 4. 사용자 xlsx 데이터 재 insert
  const raw = JSON.parse(readFileSync('scripts/2026-h1-extracted.json', 'utf8'))
  console.log(`\n✓ xlsx 데이터 로드: ${raw.length}건`)

  const txs = raw.map(r => {
    const rawCat = String(r.category).trim()
    const normCat = normalizeCategory(rawCat) ?? '기타'
    return {
      owner_id: ownerId,
      date: r.date,
      raw_category: rawCat,
      category: normCat,
      amount: r.amount,
      method: normalizeMethod(r.method),
      counterparty: r.counterparty || null,
      person: null,
      classification: classify(normCat),
      memo: r.memo || null,
    }
  })

  const BATCH = 500
  let inserted = 0
  for (let i = 0; i < txs.length; i += BATCH) {
    const batch = txs.slice(i, i + BATCH)
    const { error } = await supabase.from('transactions').insert(batch)
    if (error) { console.error(`Batch ${i} 실패:`, error.message); process.exit(1) }
    inserted += batch.length
  }
  console.log(`✓ insert 완료: ${inserted}건`)

  // 5. 검증
  const { count: finalCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`\n=== 최종 라파 transactions: ${finalCount}건 (523이어야 함) ===`)

  const { data: finalRevRows } = await supabase
    .from('transactions')
    .select('date, amount')
    .eq('owner_id', ownerId)
    .gt('amount', 0)
  const finalRevenue = (finalRevRows ?? []).reduce((s, t) => s + t.amount, 0)
  console.log(`총 매출: ${finalRevenue.toLocaleString()}원 (51,614,152원이어야 함)`)

  const { data: finalExpRows } = await supabase
    .from('transactions')
    .select('date, amount')
    .eq('owner_id', ownerId)
    .lt('amount', 0)
  const finalExp = (finalExpRows ?? []).reduce((s, t) => s + Math.abs(t.amount), 0)
  console.log(`총 지출: ${finalExp.toLocaleString()}원 (48,836,937원이어야 함)`)

  // 월별
  const byMonth = {}
  for (const t of [...(finalRevRows ?? []), ...(finalExpRows ?? [])]) {
    const ym = t.date.slice(0, 7)
    byMonth[ym] = (byMonth[ym] || 0) + 1
  }
  console.log('\n월별:')
  for (const m of Object.keys(byMonth).sort()) console.log(`  ${m}: ${byMonth[m]}건`)

  console.log('\n✓ 다른 테이블(members, instructors, passes 등)은 건드리지 않았습니다.')
}
main().catch(e => { console.error(e); process.exit(1) })
