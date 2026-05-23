// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-v2.ts
//
// NOTE: passes are inserted (not upserted). If you re-run this script, passes will
// duplicate. To reset: truncate passes, members, instructors in Supabase SQL Editor first:
//   truncate passes, members, instructors restart identity cascade;
// Then re-run this script.
//
// IMPORTANT: Run supabase/v2-schema-to-run.sql in Supabase SQL Editor BEFORE running this
// script, or it will fail with "relation does not exist".

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
    const batch = REAL_MEMBERS.slice(i, i + BATCH).map(m => ({
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

    const { data, error } = await supabase
      .from('members')
      .upsert(batch, { onConflict: 'phone', ignoreDuplicates: false })
      .select('id, name, phone')

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error('\nERROR: Supabase tables not found.')
        console.error('Run supabase/v2-schema-to-run.sql in Supabase SQL Editor first, then retry.')
        process.exit(1)
      }
      console.error(`Members batch ${i} failed:`, error.message)
      process.exit(1)
    }

    // Map key → Supabase id
    if (data) {
      for (const row of data) {
        // Find matching member key from our fixture
        const fixtureMatch = REAL_MEMBERS.find(m =>
          (m.phone && m.phone === row.phone) ||
          (!m.phone && m.name === row.name)
        )
        if (fixtureMatch) {
          memberKeyToId.set(fixtureMatch.key, row.id)
        }
      }
    }

    console.log(`  Members: inserted/upserted ${Math.min(i + BATCH, REAL_MEMBERS.length)}/${REAL_MEMBERS.length}`)
  }

  // For members without phone (upsert by phone won't work for null phone),
  // fetch them by name to get their IDs
  const nullPhoneMembers = REAL_MEMBERS.filter(m => !m.phone && !memberKeyToId.has(m.key))
  if (nullPhoneMembers.length > 0) {
    console.log(`  Fetching IDs for ${nullPhoneMembers.length} null-phone members...`)
    for (const m of nullPhoneMembers) {
      const { data } = await supabase
        .from('members')
        .select('id')
        .eq('name', m.name)
        .is('phone', null)
        .maybeSingle()
      if (data) memberKeyToId.set(m.key, data.id)
    }
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
