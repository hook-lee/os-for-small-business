/**
 * 라파 필라테스 회기점 데이터 import.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/import-rapha-data.ts [--dry-run] [--members=PATH] [--consultations=PATH] [--pass-history=PATH]
 *
 * 기본 파일 경로:
 *   ~/Downloads/회원목록_*.xlsx
 *   ~/Downloads/상담고객목록_*.xlsx
 *   ~/Downloads/수강권정보변경이력_*.xlsx
 *
 * 정책:
 *  - 라파 owner_id = auth.users(email='raphapilatesyj@gmail.com')
 *  - members: phone unique key. 매치 → NULL 필드만 update. unmatch → insert.
 *    (internal_memo / access_token / 우리 메타 보존)
 *  - passes: (member_id, pass_name, issued_at, payment_amount) 4-key 중복 체크. 없으면 insert.
 *  - consultations: (name, consultation_date) 중복 체크. 없으면 insert.
 *  - pass_events: (member_name, changed_at, event_type) 중복 체크. 없으면 insert.
 *    UNIQUE INDEX (owner_id, member_name, changed_at, event_type) WHERE source='import'
 *
 * Dry-run: 실제 INSERT/UPDATE 안 함. 리포트만 출력.
 */
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const RAPHA_EMAIL = 'raphapilatesyj@gmail.com'

interface CliArgs {
  dryRun: boolean
  membersPath: string
  consultationsPath: string
  passHistoryPath: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const get = (flag: string) => {
    const a = args.find(x => x.startsWith(flag + '='))
    return a ? a.slice(flag.length + 1) : null
  }
  const downloads = path.join(os.homedir(), 'Downloads')
  return {
    dryRun,
    membersPath: get('--members') ?? findLatest(downloads, /^회원목록.*\.xlsx$/),
    consultationsPath: get('--consultations') ?? findLatest(downloads, /^상담고객목록.*\.xlsx$/),
    passHistoryPath: get('--pass-history') ?? findLatest(downloads, /^수강권정보변경이력.*\.xlsx$/),
  }
}

function findLatest(dir: string, pattern: RegExp): string {
  if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`)
  const matches = fs.readdirSync(dir).filter(f => pattern.test(f))
  if (matches.length === 0) throw new Error(`No file matching ${pattern} in ${dir}`)
  // 가장 최근 수정 파일
  matches.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs)
  return path.join(dir, matches[0])
}

function readSheet(filePath: string): Array<Record<string, string | null>> {
  const wb = XLSX.readFile(filePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false }) as Array<Record<string, string | null>>
}

// ─────────────────────────────────────────────
// Supabase client
// ─────────────────────────────────────────────
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// ─────────────────────────────────────────────
// 헬퍼: 한국 날짜 포맷 다양한 입력을 ISO yyyy-mm-dd로
// ─────────────────────────────────────────────
function parseDate(s: string | null): string | null {
  if (!s) return null
  const t = String(s).trim()
  if (!t) return null
  // ISO 'YYYY-MM-DD' (가장 흔함)
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // '2026. 1. 2.'
  m = t.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // '2026.01.01 (목) 23:09' — 날짜만 추출
  m = t.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return null
}

function parseDateTime(s: string | null): string | null {
  if (!s) return null
  const t = String(s).trim()
  // '2026.01.01 (목) 23:09' → ISO timestamptz
  const m = t.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2}).*?(\d{1,2}):(\d{2})/)
  if (m) {
    const [, y, mo, d, h, mi] = m
    // 한국 시간대 +09:00
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi}:00+09:00`
  }
  const d = parseDate(s)
  if (d) return `${d}T00:00:00+09:00`
  return null
}

function parseInt0(s: string | null): number | null {
  if (s === null || s === undefined) return null
  const n = parseInt(String(s).trim(), 10)
  return Number.isFinite(n) ? n : null
}

function parseAmount(s: string | null): number | null {
  if (!s) return null
  // '30000' 또는 '30,000' 둘 다 처리
  const n = parseInt(String(s).replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

function parseBool(s: string | null): boolean {
  return s === 'Y' || s === 'y' || s === '연결' || s === '연결됨'
}

// 멀티라인 '항목' + '데이터' → { 항목1: 데이터1, ... }
function parseChangeFields(items: string | null, data: string | null): Record<string, string> | null {
  if (!items) return null
  const itemList = items.split('\n').map(s => s.trim()).filter(Boolean)
  const dataList = (data ?? '').split('\n').map(s => s.trim())
  const result: Record<string, string> = {}
  itemList.forEach((it, i) => {
    result[it] = dataList[i] ?? ''
  })
  return Object.keys(result).length > 0 ? result : null
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
interface Report {
  raphaOwnerId: string
  membersInserted: number
  membersUpdated: number
  membersSkipped: number
  passesInserted: number
  passesSkipped: number
  consultationsInserted: number
  consultationsSkipped: number
  passEventsInserted: number
  passEventsSkipped: number
  warnings: string[]
}

async function lookupRaphaOwnerId(): Promise<string> {
  // service_role로 auth admin API 접근
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) throw new Error(`auth users 조회 실패: ${error.message}`)
  const u = data.users.find(u => u.email === RAPHA_EMAIL)
  if (!u) throw new Error(`라파 계정 (${RAPHA_EMAIL}) 못 찾음`)
  return u.id
}

async function importMembers(
  rows: Array<Record<string, string | null>>,
  ownerId: string,
  dryRun: boolean,
  report: Report,
): Promise<Map<string, number>> {
  // xlsx는 회원×수강권 join이라 회원 정보는 첫 row만 사용. phone으로 dedupe.
  const phoneToMember = new Map<string, Record<string, string | null>>()
  const noPhoneByName = new Map<string, Record<string, string | null>>()
  for (const r of rows) {
    const phone = (r['전화번호'] ?? '').trim()
    const name = (r['이름'] ?? '').trim()
    if (!name) continue
    if (phone) {
      if (!phoneToMember.has(phone)) phoneToMember.set(phone, r)
    } else {
      if (!noPhoneByName.has(name)) noPhoneByName.set(name, r)
    }
  }
  if (noPhoneByName.size > 0) {
    report.warnings.push(`전화번호 없는 회원 ${noPhoneByName.size}명 — 이름만으로 중복 체크 (동명이인 위험)`)
  }

  // DB에서 라파 전체 회원 phone, name → id 맵
  const { data: existing, error } = await supabase
    .from('members')
    .select('id, name, phone, email, gender, birth_date, address, detail_address, memo, tier, app_connected, registered_at, last_attended_at')
    .eq('owner_id', ownerId)
  if (error) throw new Error(`기존 회원 조회 실패: ${error.message}`)

  const existingByPhone = new Map<string, typeof existing[number]>()
  const existingByName = new Map<string, typeof existing[number]>()
  for (const m of existing ?? []) {
    if (m.phone) existingByPhone.set(m.phone, m)
    existingByName.set(m.name, m)
  }

  // member name → memberId (수강권 import에서 사용)
  const memberKeyToId = new Map<string, number>()
  for (const m of existing ?? []) memberKeyToId.set(m.name, m.id)

  // 회원별 처리
  async function upsertMember(row: Record<string, string | null>): Promise<number | null> {
    const name = (row['이름'] ?? '').trim()
    const phone = (row['전화번호'] ?? '').trim() || null
    const existing = phone ? existingByPhone.get(phone) : existingByName.get(name)

    const newData: Record<string, unknown> = {
      name,
      phone,
      email: (row['이메일'] ?? '').trim() || null,
      gender: row['성별']?.trim() || null,
      birth_date: parseDate(row['생년월일']),
      address: row['주소']?.trim() || null,
      detail_address: row['상세주소']?.trim() || null,
      memo: row['메모']?.trim() || null,
      tier: row['등급']?.trim() || null,
      app_connected: parseBool(row['앱연결']),
      registered_at: parseDate(row['등록일']),
      last_attended_at: parseDate(row['최근출석일']),
    }

    if (existing) {
      // smart merge: 기존이 NULL인 필드만 채움
      const patch: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(newData)) {
        if (v === null || v === undefined || v === '') continue
        // @ts-expect-error supabase row dynamic indexing
        const cur = existing[k]
        if (cur === null || cur === undefined || cur === '') patch[k] = v
      }
      if (Object.keys(patch).length === 0) {
        report.membersSkipped++
        return existing.id
      }
      if (!dryRun) {
        const { error } = await supabase.from('members').update(patch).eq('id', existing.id).eq('owner_id', ownerId)
        if (error) {
          report.warnings.push(`회원 update 실패 [${name}]: ${error.message}`)
          return existing.id
        }
      }
      report.membersUpdated++
      return existing.id
    } else {
      // 새 회원 insert
      const row2 = { ...newData, owner_id: ownerId }
      if (dryRun) {
        report.membersInserted++
        return null
      }
      const { data, error } = await supabase.from('members').insert(row2).select('id').single()
      if (error) {
        report.warnings.push(`회원 insert 실패 [${name}]: ${error.message}`)
        return null
      }
      report.membersInserted++
      const id = (data as { id: number }).id
      memberKeyToId.set(name, id)
      if (phone) existingByPhone.set(phone, { ...existing!, id, name, phone })
      return id
    }
  }

  // unique 회원 처리
  const uniqueRows = [...phoneToMember.values(), ...noPhoneByName.values()]
  for (const r of uniqueRows) {
    const id = await upsertMember(r)
    if (id) memberKeyToId.set((r['이름'] ?? '').trim(), id)
  }

  return memberKeyToId
}

async function importPasses(
  rows: Array<Record<string, string | null>>,
  ownerId: string,
  memberKeyToId: Map<string, number>,
  dryRun: boolean,
  report: Report,
): Promise<void> {
  // 기존 passes 조회 → 4-key dedupe
  const { data: existing, error } = await supabase
    .from('passes')
    .select('member_id, pass_name, issued_at, payment_amount')
    .eq('owner_id', ownerId)
  if (error) throw new Error(`기존 수강권 조회 실패: ${error.message}`)
  const existingKeys = new Set(
    (existing ?? []).map(p => `${p.member_id}|${p.pass_name}|${p.issued_at ?? ''}|${p.payment_amount ?? ''}`),
  )

  const toInsert: Array<Record<string, unknown>> = []
  for (const r of rows) {
    const name = (r['이름'] ?? '').trim()
    const passName = (r['수강권명'] ?? '').trim()
    if (!name || !passName) continue
    const memberId = memberKeyToId.get(name)
    if (!memberId && !dryRun) {
      report.warnings.push(`수강권: 회원 매칭 실패 [${name}/${passName}]`)
      report.passesSkipped++
      continue
    }
    const issuedAt = parseDate(r['수강권발급일'])
    const amount = parseAmount(r['결제금액'])
    const key = `${memberId}|${passName}|${issuedAt ?? ''}|${amount ?? ''}`
    if (existingKeys.has(key)) {
      report.passesSkipped++
      continue
    }
    existingKeys.add(key)
    toInsert.push({
      owner_id: ownerId,
      member_id: memberId,
      pass_name: passName,
      pass_type: r['수강권종류']?.trim() || null,
      start_date: parseDate(r['수강권시작일']),
      end_date: parseDate(r['수강권종료일']),
      total_count: parseInt0(r['전체횟수']),
      remaining_count: parseInt0(r['잔여횟수']),
      available_count: parseInt0(r['예약가능횟수']),
      cancellable_count: parseInt0(r['취소가능횟수']),
      status: r['수강권상태']?.trim() || null,
      payment_type: r['결제구분']?.trim() || null,
      payment_amount: amount,
      paid_at: parseDate(r['결제일시']),
      payment_method: r['결제방법']?.trim() || null,
      installment: r['할부개월수']?.trim() || null,
      is_family: parseBool(r['패밀리수강권']),
      issued_at: issuedAt,
      last_modified_at: parseDate(r['수강권최종수정일']),
    })
  }
  report.passesInserted += toInsert.length
  if (dryRun || toInsert.length === 0) return
  const BATCH = 200
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { error } = await supabase.from('passes').insert(batch)
    if (error) report.warnings.push(`passes batch ${i} 실패: ${error.message}`)
  }
}

async function importConsultations(
  rows: Array<Record<string, string | null>>,
  ownerId: string,
  dryRun: boolean,
  report: Report,
): Promise<void> {
  const { data: existing } = await supabase
    .from('consultations')
    .select('name, consultation_date')
    .eq('owner_id', ownerId)
  const existingKeys = new Set(
    (existing ?? []).map(c => `${c.name}|${c.consultation_date}`),
  )

  const toInsert: Array<Record<string, unknown>> = []
  for (const r of rows) {
    const name = (r['이름'] ?? '').trim()
    const date = parseDate(r['상담일자'])
    if (!name || !date) continue
    const key = `${name}|${date}`
    if (existingKeys.has(key)) {
      report.consultationsSkipped++
      continue
    }
    existingKeys.add(key)
    toInsert.push({
      owner_id: ownerId,
      name,
      phone: r['전화번호']?.trim() || null,
      consultation_date: date,
      inflow_channel: r['인입경로']?.trim() || null,
      content: r['상담내용']?.trim() || null,
      staff_name: r['담당스태프']?.trim() || null,
      converted_to_member: (r['회원등록여부'] ?? '').trim() === 'Y',
    })
  }
  report.consultationsInserted += toInsert.length
  if (dryRun || toInsert.length === 0) return
  const { error } = await supabase.from('consultations').insert(toInsert)
  if (error) report.warnings.push(`consultations 실패: ${error.message}`)
}

async function importPassEvents(
  rows: Array<Record<string, string | null>>,
  ownerId: string,
  memberKeyToId: Map<string, number>,
  dryRun: boolean,
  report: Report,
): Promise<void> {
  const { data: existing } = await supabase
    .from('pass_events')
    .select('member_name, changed_at, event_type')
    .eq('owner_id', ownerId)
    .eq('source', 'import')
  const existingKeys = new Set(
    (existing ?? []).map(e => `${e.member_name}|${e.changed_at}|${e.event_type}`),
  )

  const eventTypeMap: Record<string, 'issued' | 'modified' | 'expired' | 'deleted'> = {
    '발급': 'issued',
    '변경': 'modified',
    '만료': 'expired',
    '삭제': 'deleted',
  }

  const toInsert: Array<Record<string, unknown>> = []
  for (const r of rows) {
    const memberName = (r['회원명'] ?? '').trim()
    const changedAt = parseDateTime(r['변경일시'])
    const typeRaw = (r['종류'] ?? '').trim()
    const eventType = eventTypeMap[typeRaw] ?? 'modified'
    if (!memberName || !changedAt) continue
    const key = `${memberName}|${changedAt}|${eventType}`
    if (existingKeys.has(key)) {
      report.passEventsSkipped++
      continue
    }
    existingKeys.add(key)
    toInsert.push({
      owner_id: ownerId,
      pass_id: null,
      member_id: memberKeyToId.get(memberName) ?? null,
      member_name: memberName,
      pass_name: r['수강권명']?.trim() || null,
      event_type: eventType,
      changed_at: changedAt,
      changed_by: r['변경한 사람']?.trim() || null,
      changed_by_id: null,
      before_data: parseChangeFields(r['변경전-항목'], r['변경전-데이터']),
      after_data: parseChangeFields(r['변경후-항목'], r['변경후-데이터']),
      source: 'import',
    })
  }
  report.passEventsInserted += toInsert.length
  if (dryRun || toInsert.length === 0) return
  const BATCH = 200
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { error } = await supabase.from('pass_events').insert(batch)
    if (error) report.warnings.push(`pass_events batch ${i} 실패: ${error.message}`)
  }
}

async function main() {
  const args = parseArgs()
  console.log(`\n${args.dryRun ? '🟡 DRY-RUN MODE — DB 변경 없음' : '🟢 LIVE MODE — DB에 실제 변경됨'}\n`)
  console.log('Files:')
  console.log(`  members        = ${args.membersPath}`)
  console.log(`  consultations  = ${args.consultationsPath}`)
  console.log(`  pass history   = ${args.passHistoryPath}`)

  const ownerId = await lookupRaphaOwnerId()
  console.log(`\n라파 owner_id = ${ownerId}\n`)

  const report: Report = {
    raphaOwnerId: ownerId,
    membersInserted: 0, membersUpdated: 0, membersSkipped: 0,
    passesInserted: 0, passesSkipped: 0,
    consultationsInserted: 0, consultationsSkipped: 0,
    passEventsInserted: 0, passEventsSkipped: 0,
    warnings: [],
  }

  const memberRows = readSheet(args.membersPath)
  console.log(`📂 회원목록.xlsx: ${memberRows.length} rows`)
  const memberKeyToId = await importMembers(memberRows, ownerId, args.dryRun, report)

  console.log(`📂 수강권 import (members와 같은 파일 — 회원×수강권 join)`)
  await importPasses(memberRows, ownerId, memberKeyToId, args.dryRun, report)

  const consultRows = readSheet(args.consultationsPath)
  console.log(`📂 상담고객.xlsx: ${consultRows.length} rows`)
  await importConsultations(consultRows, ownerId, args.dryRun, report)

  const historyRows = readSheet(args.passHistoryPath)
  console.log(`📂 수강권변경이력.xlsx: ${historyRows.length} rows`)
  await importPassEvents(historyRows, ownerId, memberKeyToId, args.dryRun, report)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 리포트 ${args.dryRun ? '(예상)' : ''}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`회원       — 신규 ${report.membersInserted} / 업데이트 ${report.membersUpdated} / 변경없음 ${report.membersSkipped}`)
  console.log(`수강권     — 신규 ${report.passesInserted} / 중복 ${report.passesSkipped}`)
  console.log(`상담       — 신규 ${report.consultationsInserted} / 중복 ${report.consultationsSkipped}`)
  console.log(`수강권이력 — 신규 ${report.passEventsInserted} / 중복 ${report.passEventsSkipped}`)
  if (report.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${report.warnings.length}):`)
    report.warnings.slice(0, 20).forEach(w => console.log(`   - ${w}`))
    if (report.warnings.length > 20) console.log(`   ... 외 ${report.warnings.length - 20}건`)
  }
  console.log()
  if (args.dryRun) {
    console.log(`✅ Dry-run 완료. 실제 실행은 --dry-run 빼고 다시 실행하세요.`)
  } else {
    console.log(`✅ Import 완료.`)
  }
}

main().catch(err => {
  console.error('💥 실패:', err)
  process.exit(1)
})
