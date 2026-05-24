// Usage: npx tsx scripts/diagnose-db.ts (env from .env.local 자동 로드 X — 직접 export 필요)
// 또는: npx dotenv -e .env.local -- npx tsx scripts/diagnose-db.ts
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !key) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

interface Check {
  name: string
  table: string
  describe: string
  seedRequired: boolean
}

const CHECKS: Check[] = [
  { name: 'transactions',       table: 'transactions',       describe: '거래 내역',                  seedRequired: false },
  { name: 'profile',            table: 'profile',            describe: '운영자 프로필 (id=1)',       seedRequired: true },
  { name: 'members',            table: 'members',            describe: '회원 마스터',                seedRequired: false },
  { name: 'instructors',        table: 'instructors',        describe: '강사',                       seedRequired: false },
  { name: 'passes',             table: 'passes',             describe: '수강권 이력',                seedRequired: false },
  { name: 'pass_products',      table: 'pass_products',      describe: '수강권 카탈로그',            seedRequired: true },
  { name: 'lessons',            table: 'lessons',            describe: '수업 로그',                  seedRequired: false },
  { name: 'payroll_records',    table: 'payroll_records',    describe: '강사 월별 급여',             seedRequired: false },
  { name: 'message_records',    table: 'message_records',    describe: '메시지 발송 (v2.6)',         seedRequired: false },
  { name: 'group_sessions',     table: 'group_sessions',     describe: '그룹 수업 (v2.8)',           seedRequired: false },
  { name: 'group_reservations', table: 'group_reservations', describe: '그룹 예약 (v2.8)',           seedRequired: false },
  { name: 'expense_categories', table: 'expense_categories', describe: '비용 카테고리 (v2.9)',       seedRequired: true },
  { name: 'pass_adjustments',   table: 'pass_adjustments',   describe: '수강권 회차 조정 (v2.10)',   seedRequired: false },
]

async function main() {
  console.log('🔍 Supabase 상태 진단\n')
  const missing: string[] = []
  const empty: { table: string; describe: string }[] = []
  const ok: string[] = []

  for (const c of CHECKS) {
    const { count, error } = await supabase.from(c.table).select('*', { count: 'exact', head: true })
    if (error) {
      const isMissing = /does not exist|relation .* does not exist|Could not find the table/i.test(error.message)
      if (isMissing) {
        missing.push(c.table)
        console.log(`  ❌ ${c.table.padEnd(22)} — 테이블 없음 (${c.describe})`)
      } else {
        console.log(`  ⚠️ ${c.table.padEnd(22)} — ${error.message}`)
      }
      continue
    }
    const n = count ?? 0
    if (n === 0) {
      if (c.seedRequired) {
        empty.push({ table: c.table, describe: c.describe })
        console.log(`  ⚠️ ${c.table.padEnd(22)} — 0 rows (시드 필요: ${c.describe})`)
      } else {
        console.log(`  ○  ${c.table.padEnd(22)} — 0 rows (시드 불필요)`)
      }
    } else {
      ok.push(c.table)
      console.log(`  ✓  ${c.table.padEnd(22)} — ${n} rows`)
    }
  }

  // profile 컬럼 체크 (tax_payer_type)
  console.log('\n🔍 profile.tax_payer_type 컬럼 체크')
  const { data: profileRow, error: profileErr } = await supabase
    .from('profile')
    .select('id, tax_payer_type')
    .eq('id', 1)
    .maybeSingle()
  if (profileErr) {
    if (/tax_payer_type/.test(profileErr.message)) {
      console.log(`  ❌ tax_payer_type 컬럼 없음 — v2.9 마이그레이션 필요`)
    } else {
      console.log(`  ⚠️ ${profileErr.message}`)
    }
  } else {
    console.log(`  ✓  tax_payer_type = ${(profileRow as { tax_payer_type?: string } | null)?.tax_payer_type ?? '(null)'}`)
  }

  // 요약
  console.log('\n========== 요약 ==========')
  console.log(`테이블 OK:     ${ok.length}`)
  console.log(`테이블 누락:   ${missing.length}${missing.length > 0 ? ' → ' + missing.join(', ') : ''}`)
  console.log(`시드 필요:     ${empty.length}${empty.length > 0 ? ' → ' + empty.map(e => e.table).join(', ') : ''}`)

  // JSON 출력 (다음 단계 자동화용)
  const summary = {
    missing,
    empty: empty.map(e => e.table),
    ok,
    profileHasTaxPayerType: !profileErr,
  }
  console.log('\n__SUMMARY_JSON__' + JSON.stringify(summary))
}

main().catch(e => { console.error(e); process.exit(1) })
