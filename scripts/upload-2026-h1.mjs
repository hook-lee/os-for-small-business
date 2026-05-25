import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('❌ env 미설정'); process.exit(1) }

const TARGET_EMAIL = 'raphapilatesyj@gmail.com'
const supabase = createClient(url, key, { auth: { persistSession: false } })

// ───────── 카테고리 normalize ─────────
const NORMALIZATION_MAP = {
  '임차료': '임대료',
  '소모품비': '소모품',
  '소모푸': '소모품',
  '마케팅': '마케팅비',
  '월급': '급여',
  '유진급여': '유진 급여',
  '의류': '의류비',
  '교육': '교육비',
  '인쇄비': '도서인쇄비',
  '프린트': '도서인쇄비',
  '보혐료': '보험료',
  '경좃비': '경조사비',
  '경조선물비': '경조사비',
  '간식': '식비',
  '약': '의료비',
  '운송비': '수수료',
  '정기': '정기결제',
  '복지': '복리후생비',
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

// ───────── 분류 (classification) ─────────
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

// ───────── method normalize ─────────
function normalizeMethod(m) {
  if (!m) return '카드'
  const t = String(m).trim()
  if (t === '카드') return '카드'
  if (t === '계좌이체') return '계좌이체'
  if (t === '현금') return '현금'
  if (t === '네이버페이') return '카드'   // 카드로 매핑
  return '카드'
}

async function main() {
  // 1. owner_id 조회
  const { data: userData, error: userErr } = await supabase.auth.admin.listUsers()
  if (userErr) { console.error('user list 실패:', userErr.message); process.exit(1) }
  const user = userData.users.find(u => u.email === TARGET_EMAIL)
  if (!user) { console.error(`❌ ${TARGET_EMAIL} 계정 없음`); process.exit(1) }
  const ownerId = user.id
  console.log(`✓ ${TARGET_EMAIL} owner_id: ${ownerId}`)

  // 2. 추출된 데이터 로드
  const raw = JSON.parse(readFileSync('scripts/2026-h1-extracted.json', 'utf8'))
  console.log(`✓ ${raw.length}건 로드`)

  // 3. transaction 형태로 변환
  const txs = raw.map(r => {
    const rawCat = String(r.category).trim()
    const normCat = normalizeCategory(rawCat)
    return {
      owner_id: ownerId,
      date: r.date,
      raw_category: rawCat,
      category: normCat ?? '기타',
      amount: r.amount,
      method: normalizeMethod(r.method),
      counterparty: r.counterparty || null,
      person: null,
      classification: classify(normCat ?? '기타'),
      memo: r.memo || null,
    }
  })

  // 4. 기존 2026-01 ~ 2026-05 데이터 조회 (중복 체크용)
  const { data: existing, error: fetchErr } = await supabase
    .from('transactions')
    .select('date, raw_category, amount, memo')
    .eq('owner_id', ownerId)
    .gte('date', '2026-01-01')
    .lte('date', '2026-05-31')
  if (fetchErr) { console.error('기존 조회 실패:', fetchErr.message); process.exit(1) }

  const existingKeys = new Set(
    (existing ?? []).map(e => `${e.date}|${e.raw_category}|${e.amount}|${e.memo ?? ''}`)
  )
  console.log(`✓ 기존 2026 H1 transactions: ${existing?.length ?? 0}건`)

  // 5. 새로 insert할 것만 필터
  const newTxs = txs.filter(t => {
    const key = `${t.date}|${t.raw_category}|${t.amount}|${t.memo ?? ''}`
    return !existingKeys.has(key)
  })
  console.log(`✓ 신규 insert 대상: ${newTxs.length}건 (중복 ${txs.length - newTxs.length}건 스킵)`)

  if (newTxs.length === 0) {
    console.log('✓ 이미 모두 적용됨. 종료.')
    return
  }

  // 6. 1000건씩 배치 insert
  const BATCH = 500
  let inserted = 0
  for (let i = 0; i < newTxs.length; i += BATCH) {
    const batch = newTxs.slice(i, i + BATCH)
    const { error } = await supabase.from('transactions').insert(batch)
    if (error) { console.error(`Batch ${i} 실패:`, error.message); process.exit(1) }
    inserted += batch.length
    console.log(`  ... ${inserted}/${newTxs.length}`)
  }

  console.log(`\n✓ 완료: ${inserted}건 insert됨`)

  // 7. 검증
  const { count: totalCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .gte('date', '2026-01-01')
    .lte('date', '2026-05-31')
  console.log(`✓ 라파 2026 H1 transactions 총: ${totalCount}건`)

  const { data: byMonth } = await supabase
    .from('transactions')
    .select('date')
    .eq('owner_id', ownerId)
    .gte('date', '2026-01-01')
    .lte('date', '2026-05-31')
  const monthCounts = {}
  for (const t of byMonth ?? []) {
    const ym = t.date.slice(0, 7)
    monthCounts[ym] = (monthCounts[ym] || 0) + 1
  }
  console.log('월별:')
  for (const m of Object.keys(monthCounts).sort()) console.log(`  ${m}: ${monthCounts[m]}건`)
}

main().catch(e => { console.error(e); process.exit(1) })
