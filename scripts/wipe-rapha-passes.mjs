/**
 * 라파 owner의 passes 데이터 전체 삭제.
 *
 * cascade로 자동 삭제되는 것: group_reservations, pass_adjustments
 * SET NULL로 처리되는 것: lessons.pass_id (lessons 자체는 유지)
 *
 * 절대 안 건드림: members, instructors, pass_products,
 *   transactions(이미 정리 끝), lessons(데이터 자체)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const TARGET_EMAIL = 'raphapilatesyj@gmail.com'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  const { data: u } = await supabase.auth.admin.listUsers()
  const user = u.users.find(x => x.email === TARGET_EMAIL)
  if (!user) { console.error(`❌ ${TARGET_EMAIL} 없음`); process.exit(1) }
  const ownerId = user.id
  console.log(`✓ owner_id: ${ownerId}`)

  // 삭제 전 카운트
  const { count: beforePasses } = await supabase
    .from('passes')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`\n현재 라파 passes: ${beforePasses}건`)

  const { data: revRows } = await supabase
    .from('passes')
    .select('payment_amount')
    .eq('owner_id', ownerId)
    .gt('payment_amount', 0)
  const totalRev = (revRows ?? []).reduce((s, r) => s + (r.payment_amount ?? 0), 0)
  console.log(`passes 결제 합계: ${totalRev.toLocaleString()}원`)

  // 관련 테이블 사전 카운트 (cascade 영향 추적용)
  const { count: groupResCount } = await supabase
    .from('group_reservations')
    .select('*', { count: 'exact', head: true })
    .not('pass_id', 'is', null)
  console.log(`group_reservations (pass_id 있는 것): ${groupResCount}건 ← cascade로 같이 삭제`)

  const { count: adjCount } = await supabase
    .from('pass_adjustments')
    .select('*', { count: 'exact', head: true })
  console.log(`pass_adjustments: ${adjCount}건 ← cascade로 같이 삭제`)

  const { count: lessonsWithPass } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .not('pass_id', 'is', null)
  console.log(`lessons (pass_id 있는 것): ${lessonsWithPass}건 ← pass_id가 null로 변경`)

  // 삭제 실행
  console.log(`\n⚠ 라파 passes 전체 삭제...`)
  const { error: delErr } = await supabase
    .from('passes')
    .delete()
    .eq('owner_id', ownerId)
  if (delErr) { console.error('실패:', delErr.message); process.exit(1) }

  // 검증
  const { count: afterPasses } = await supabase
    .from('passes')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`✓ 삭제 완료. passes: ${afterPasses}건 (0이어야 함)`)

  // 영향 확인
  const { count: membersUnchanged } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`\n=== 영향 검증 ===`)
  console.log(`✓ members (회원): ${membersUnchanged}건 — 그대로 유지`)

  const { count: instrUnchanged } = await supabase
    .from('instructors')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`✓ instructors (강사): ${instrUnchanged}건 — 그대로 유지`)

  const { count: txCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`✓ transactions (xlsx 입력): ${txCount}건 — 그대로 (523이어야 함)`)

  const { count: productsCount } = await supabase
    .from('pass_products')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
  console.log(`✓ pass_products (수강권 카탈로그): ${productsCount}건 — 그대로 유지`)
}
main().catch(e => { console.error(e); process.exit(1) })
