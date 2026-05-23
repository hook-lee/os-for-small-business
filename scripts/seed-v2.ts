// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-v2.ts
//
// NOTE: members and passes are INSERTED (not upserted). instructors are upserted by phone.
// If you re-run this script after a successful run, members and passes will DUPLICATE.
// To reset: truncate in Supabase SQL Editor first:
//   truncate passes, members restart identity cascade;
//   -- (instructors can stay; they're upserted)
// Then re-run this script.
//
// IMPORTANT: Run supabase/v2-schema-to-run.sql in Supabase SQL Editor BEFORE running this
// script, or it will fail with "relation does not exist".
//
// Why not upsert for members? `members_phone_uniq` is a PARTIAL unique index
// (where phone is not null), which PostgREST's onConflict can't target.

import { createClient } from '@supabase/supabase-js'
import { REAL_MEMBERS, REAL_PASSES } from '../tests/fixtures/real-members'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

// ---------- Hardcoded instructors ----------
type InstructorRole = 'owner' | 'instructor' | 'admin'
interface InstructorRow {
  name: string
  phone: string
  role: InstructorRole
  default_hourly_rate: number
  color: string
  active: boolean
}
const INSTRUCTORS: InstructorRow[] = [
  { name: '김우영', phone: '010-2019-8967', role: 'instructor', default_hourly_rate: 30000, color: '#f472b6', active: true },
  { name: '김유진', phone: '010-7751-0503', role: 'owner', default_hourly_rate: 30000, color: '#60a5fa', active: true },
  { name: '김현정', phone: '010-2419-2745', role: 'instructor', default_hourly_rate: 30000, color: '#fbbf24', active: true },
]

async function main() {
  // ---------- 1. Instructors ----------
  console.log('Seeding instructors...')
  const instructorIdMap = new Map<string, number>()  // name → id

  for (const inst of INSTRUCTORS) {
    // Check if already exists by phone (idempotent)
    const { data: existing } = await supabase
      .from('instructors')
      .select('id, name')
      .eq('phone', inst.phone)
      .maybeSingle()

    if (existing) {
      console.log(`  Skipping ${inst.name} (already exists, id=${existing.id})`)
      instructorIdMap.set(inst.name, existing.id)
    } else {
      const { data, error } = await supabase
        .from('instructors')
        .insert(inst)
        .select('id')
        .single()
      if (error) {
        console.error(`  Failed to insert instructor ${inst.name}:`, error.message)
        process.exit(1)
      }
      console.log(`  Inserted ${inst.name} (id=${data.id})`)
      instructorIdMap.set(inst.name, data.id)
    }
  }

  // ---------- 2. Members ----------
  console.log(`\nSeeding ${REAL_MEMBERS.length} members...`)
  const memberKeyToId = new Map<string, number>()  // key → Supabase id

  const BATCH = 500
  for (let i = 0; i < REAL_MEMBERS.length; i += BATCH) {
    const slice = REAL_MEMBERS.slice(i, i + BATCH)
    const batch = slice.map(m => ({
      name: m.name,
      phone: m.phone,
      email: m.email,
      gender: m.gender,
      birth_date: m.birthDate,
      address: m.address,
      detail_address: m.detailAddress,
      memo: m.memo,
      tier: m.tier,
      app_connected: m.appConnected,
      registered_at: m.registeredAt,
      last_attended_at: m.lastAttendedAt,
    }))

    // Plain insert (no upsert — partial unique index can't be ON CONFLICT target)
    const { data, error } = await supabase
      .from('members')
      .insert(batch)
      .select('id')

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error('\nERROR: Supabase tables not found.')
        console.error('Run supabase/v2-schema-to-run.sql in Supabase SQL Editor first, then retry.')
        process.exit(1)
      }
      if (error.message.includes('duplicate key') && error.message.includes('phone')) {
        console.error('\nERROR: Duplicate phone — members already seeded? To re-seed, truncate first:')
        console.error('  truncate passes, members restart identity cascade;')
        process.exit(1)
      }
      console.error(`Members batch ${i} failed:`, error.message)
      process.exit(1)
    }

    // PostgREST insert preserves input order in the returned rows
    if (data) {
      for (let j = 0; j < data.length; j++) {
        memberKeyToId.set(slice[j].key, data[j].id)
      }
    }

    console.log(`  Members: inserted ${Math.min(i + BATCH, REAL_MEMBERS.length)}/${REAL_MEMBERS.length}`)
  }

  console.log(`  Mapped ${memberKeyToId.size}/${REAL_MEMBERS.length} member IDs`)

  // ---------- 3. Passes ----------
  console.log(`\nSeeding ${REAL_PASSES.length} passes...`)

  // Track instructor name mismatches
  const unmatchedInstructors = new Set<string>()

  const passRows = REAL_PASSES.map(p => {
    const memberId = memberKeyToId.get(p.memberKey)
    if (!memberId) {
      console.warn(`  WARNING: No member ID for key=${p.memberKey}`)
      return null
    }

    let instructorId: number | null = null
    if (p.instructorName) {
      const id = instructorIdMap.get(p.instructorName)
      if (id) {
        instructorId = id
      } else {
        unmatchedInstructors.add(p.instructorName)
      }
    }

    return {
      member_id: memberId,
      instructor_id: instructorId,
      pass_name: p.passName,
      pass_type: p.passType,
      start_date: p.startDate,
      end_date: p.endDate,
      total_count: p.totalCount,
      remaining_count: p.remainingCount,
      available_count: p.availableCount,
      cancellable_count: p.cancellableCount,
      status: p.status,
      payment_type: p.paymentType,
      payment_amount: p.paymentAmount,
      paid_at: p.paidAt,
      payment_method: p.paymentMethod,
      installment: p.installment,
      is_family: p.isFamily,
      issued_at: p.issuedAt,
      last_modified_at: p.lastModifiedAt,
    }
  }).filter((r): r is NonNullable<typeof r> => r !== null)

  if (unmatchedInstructors.size > 0) {
    console.warn(`  WARNING: ${unmatchedInstructors.size} unmatched instructor names (set to null):`, [...unmatchedInstructors])
  }

  for (let i = 0; i < passRows.length; i += BATCH) {
    const batch = passRows.slice(i, i + BATCH)
    const { error } = await supabase.from('passes').insert(batch)
    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error('\nERROR: Supabase tables not found.')
        console.error('Run supabase/v2-schema-to-run.sql in Supabase SQL Editor first, then retry.')
        process.exit(1)
      }
      console.error(`Passes batch ${i} failed:`, error.message)
      process.exit(1)
    }
    console.log(`  Passes: inserted ${Math.min(i + BATCH, passRows.length)}/${passRows.length}`)
  }

  console.log('\nSeed v2 complete.')
  console.log(`  Instructors: ${instructorIdMap.size}`)
  console.log(`  Members: ${memberKeyToId.size}`)
  console.log(`  Passes: ${passRows.length}`)
}

main().catch(e => {
  if (String(e).includes('relation') && String(e).includes('does not exist')) {
    console.error('\nERROR: Supabase tables not found.')
    console.error('Run supabase/v2-schema-to-run.sql in Supabase SQL Editor first, then retry.')
  } else {
    console.error('Seed v2 failed:', e)
  }
  process.exit(1)
})
