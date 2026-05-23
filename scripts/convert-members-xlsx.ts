// Usage: npx tsx scripts/convert-members-xlsx.ts <path-to-xlsx> [output-path]
// Reads xlsx → dedupes members → outputs TS fixture file at tests/fixtures/real-members.ts

import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

// ---------- helpers ----------

function parseKoreanDate(val: string | null | undefined): string | null {
  if (!val) return null
  const str = String(val).trim()
  if (!str) return null
  // "1999년 1월 5일" → "1999-01-05"
  const m = str.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/)
  if (m) {
    const y = m[1]
    const mo = m[2].padStart(2, '0')
    const d = m[3].padStart(2, '0')
    return `${y}-${mo}-${d}`
  }
  // Already ISO-ish
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return null
}

function parseDate(val: any): string | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).trim()
  if (!str) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return null
}

function parseAmount(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Math.round(val)
  const str = String(val).replace(/,/g, '').trim()
  if (!str) return null
  const n = Number(str)
  return isNaN(n) ? null : Math.round(n)
}

function parseInstallment(val: any): string | null {
  if (val === null || val === undefined || val === '') return null
  const str = String(val).trim()
  if (!str) return null
  if (str === '일시불') return '일시불'
  const n = Number(str)
  if (!isNaN(n) && n > 0) return `${n}개월`
  return str
}

function parseCount(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  const n = Number(val)
  return isNaN(n) ? null : Math.round(n)
}

function nullify(val: any): string | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  return s === '' ? null : s
}

// Compare two ISO date strings, return latest. Null is treated as earliest.
function latestDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

// ---------- main ----------

async function main() {
  const xlsxPath = process.argv[2]
  const outputPath = process.argv[3] || path.resolve(__dirname, '../tests/fixtures/real-members.ts')

  if (!xlsxPath) {
    console.error('Usage: npx tsx scripts/convert-members-xlsx.ts <path-to-xlsx> [output-path]')
    process.exit(1)
  }

  if (!fs.existsSync(xlsxPath)) {
    console.error(`File not found: ${xlsxPath}`)
    process.exit(1)
  }

  console.log(`Reading: ${xlsxPath}`)
  const wb = XLSX.readFile(xlsxPath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null }) as any[][]

  const header = rows[0] as string[]
  const dataRows = rows.slice(1)
  console.log(`Total rows (excl header): ${dataRows.length}`)

  // ---------- build member map ----------
  // key = phone if present, else "name:<name>"
  const memberMap = new Map<string, {
    key: string
    name: string
    phone: string | null
    email: string | null
    gender: string | null
    birthDate: string | null
    address: string | null
    detailAddress: string | null
    memo: string | null
    tier: string | null
    appConnected: boolean
    registeredAt: string | null
    lastAttendedAt: string | null
  }>()

  const passes: Array<{
    memberKey: string
    instructorName: string | null
    passName: string
    passType: string | null
    startDate: string | null
    endDate: string | null
    totalCount: number | null
    remainingCount: number | null
    availableCount: number | null
    cancellableCount: number | null
    status: string | null
    paymentType: string | null
    paymentAmount: number | null
    paidAt: string | null
    paymentMethod: string | null
    installment: string | null
    isFamily: boolean
    issuedAt: string | null
    lastModifiedAt: string | null
  }> = []

  for (const row of dataRows) {
    const name = nullify(row[0])
    if (!name) continue  // skip empty rows

    const phone = nullify(row[2])
    const memberKey = phone ? phone : `name:${name}`

    // Upsert member
    if (!memberMap.has(memberKey)) {
      memberMap.set(memberKey, {
        key: memberKey,
        name,
        phone,
        email: nullify(row[3]),
        gender: nullify(row[7]),
        birthDate: parseKoreanDate(nullify(row[8])),
        address: nullify(row[9]),
        detailAddress: nullify(row[10]),
        memo: nullify(row[11]),
        tier: nullify(row[1]),
        appConnected: nullify(row[4]) === '연결',
        registeredAt: parseDate(row[5]),
        lastAttendedAt: parseDate(row[6]),
      })
    } else {
      // Update lastAttendedAt to latest
      const existing = memberMap.get(memberKey)!
      existing.lastAttendedAt = latestDate(existing.lastAttendedAt, parseDate(row[6]))
      // Update appConnected if newly connected
      if (nullify(row[4]) === '연결') existing.appConnected = true
    }

    // Pass name is required
    const passName = nullify(row[12])
    if (!passName) continue  // skip rows without pass info

    const instructorRaw = nullify(row[24])

    passes.push({
      memberKey,
      instructorName: instructorRaw,
      passName,
      passType: nullify(row[13]),
      startDate: parseDate(row[14]),
      endDate: parseDate(row[15]),
      totalCount: parseCount(row[17]),
      remainingCount: parseCount(row[18]),
      availableCount: parseCount(row[19]),
      cancellableCount: parseCount(row[20]),
      status: nullify(row[23]),
      paymentType: nullify(row[25]),
      paymentAmount: parseAmount(row[26]),
      paidAt: parseDate(row[27]),
      paymentMethod: nullify(row[28]),
      installment: parseInstallment(row[29]),
      isFamily: nullify(row[16]) === 'Y',
      issuedAt: parseDate(row[21]),
      lastModifiedAt: parseDate(row[22]),
    })
  }

  const members = [...memberMap.values()]
  console.log(`Unique members: ${members.length}`)
  console.log(`Passes: ${passes.length}`)

  if (members.length < 250 || members.length > 320) {
    console.warn(`WARNING: Unexpected member count ${members.length} (expected ~285)`)
  }
  if (passes.length < 750 || passes.length > 830) {
    console.warn(`WARNING: Unexpected pass count ${passes.length} (expected ~793 — matches data rows)`)
  }

  // ---------- write fixture ----------
  const now = new Date().toISOString()

  const membersJson = JSON.stringify(members, null, 2)
    .replace(/"([^"]+)":/g, '$1:')  // drop quotes from keys for TS style

  const passesJson = JSON.stringify(passes, null, 2)
    .replace(/"([^"]+)":/g, '$1:')

  const output = `// Auto-generated from 스튜디오메이트 회원목록 xlsx export.
// Source: ${dataRows.length} rows → ${members.length} unique members + ${passes.length} passes
// Generated: ${now}

export interface RealMember {
  key: string  // phone or "name:<n>"
  name: string
  phone: string | null
  email: string | null
  gender: string | null
  birthDate: string | null  // yyyy-mm-dd
  address: string | null
  detailAddress: string | null
  memo: string | null
  tier: string | null
  appConnected: boolean
  registeredAt: string | null
  lastAttendedAt: string | null
}

export interface RealPass {
  memberKey: string
  instructorName: string | null  // 담당강사 이름 (instructor_id 매핑은 seed 단계에서)
  passName: string
  passType: string | null
  startDate: string | null
  endDate: string | null
  totalCount: number | null
  remainingCount: number | null
  availableCount: number | null
  cancellableCount: number | null
  status: string | null
  paymentType: string | null
  paymentAmount: number | null
  paidAt: string | null
  paymentMethod: string | null
  installment: string | null
  isFamily: boolean
  issuedAt: string | null
  lastModifiedAt: string | null
}

export const REAL_MEMBERS: RealMember[] = ${membersJson}

export const REAL_PASSES: RealPass[] = ${passesJson}
`

  fs.writeFileSync(outputPath, output, 'utf-8')
  console.log(`Written: ${outputPath}`)
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
