/**
 * 지출.xlsx 전체에서 모든 거래 데이터 추출.
 *
 * 우선순위:
 * 1. 월별 시트 (2024 4월 ~ 2026 5월) — 각 월의 진짜 source
 * 2. "전체 통합" 시트는 검증용 (이미 월별에서 추출하니 굳이 합칠 필요 X)
 *
 * 이전 inspect 결과: "전체 통합"의 2026-01 = 71건 / 월별 시트 2026-01 = 123건
 * → 월별 시트가 더 풍부. 월별을 source of truth로.
 */
import XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'

const FILE = 'C:/Users/leech/Downloads/지출 (1).xlsx'
const wb = XLSX.readFile(FILE)

// 추출 대상 시트 (Copy of ... 같은 백업 제외)
// 시트명 패턴: "YYYY M월 지출"
const allSheets = wb.SheetNames.filter(n => /^\d{4}\s\d{1,2}월\s지출$/.test(n))
console.log(`처리할 월별 시트 ${allSheets.length}개:`)
console.log(allSheets.sort())

function excelDateToString(serial) {
  if (typeof serial !== 'number' || serial < 25569) return null
  const ms = (serial - 25569) * 86400 * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function parseSheetName(name) {
  // "2024 4월 지출" → { year: 2024, month: 4 }
  const m = name.match(/^(\d{4})\s(\d{1,2})월\s지출$/)
  if (!m) return null
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) }
}

const allTxs = []
let totalSkippedHeader = 0
let totalSkippedEmpty = 0
let totalSkippedWrongMonth = 0

for (const sheetName of allSheets.sort()) {
  const meta = parseSheetName(sheetName)
  if (!meta) continue

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

  // 헤더 확인 — 통상: No, 날짜, 계정과목, 금액, 수단, 금액(누계), 비고, 비고2, 항목, 정산, 정산비고
  // 일부 옛 시트는 헤더가 다를 수도. 동적 매핑.
  const header = rows[0] ?? []
  const COL = {
    no: header.indexOf('No.'),
    date: header.indexOf('날짜'),
    category: header.indexOf('계정과목'),
    amount: -1,    // 첫 번째 '금액' (두 번째는 누계라 무시)
    method: header.indexOf('수단'),
    memo: header.indexOf('비고'),
    memo2: header.indexOf('비고2'),
  }
  // '금액' 컬럼: 첫 등장만
  for (let i = 0; i < header.length; i++) {
    if (header[i] === '금액') { COL.amount = i; break }
  }
  if (COL.date < 0 || COL.category < 0 || COL.amount < 0) {
    console.log(`!! [${sheetName}] 헤더 매핑 실패 — skip`)
    continue
  }

  let extracted = 0
  let header_skip = 0
  let empty_skip = 0
  let wrong_month_skip = 0

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.every(v => v === null)) { empty_skip++; continue }
    const cat = r[COL.category]
    if (!cat) { empty_skip++; continue }
    if (typeof cat === 'string' && /^\d{1,2}월\s*종합/.test(cat.trim())) {
      header_skip++
      continue
    }
    const dateStr = excelDateToString(r[COL.date])
    if (!dateStr) { empty_skip++; continue }
    const rowMonth = parseInt(dateStr.slice(5, 7), 10)
    const rowYear = parseInt(dateStr.slice(0, 4), 10)
    if (rowMonth !== meta.month || rowYear !== meta.year) {
      wrong_month_skip++
      continue
    }
    const amount = Number(r[COL.amount])
    if (!Number.isFinite(amount) || amount === 0) { empty_skip++; continue }

    allTxs.push({
      date: dateStr,
      category: String(cat).trim(),
      amount,
      method: r[COL.method] ? String(r[COL.method]).trim() : null,
      memo: r[COL.memo] ? String(r[COL.memo]).trim() : null,
      counterparty: r[COL.memo2] ? String(r[COL.memo2]).trim() : null,
      _source: sheetName,
    })
    extracted++
  }
  totalSkippedHeader += header_skip
  totalSkippedEmpty += empty_skip
  totalSkippedWrongMonth += wrong_month_skip
  console.log(`[${sheetName}] ${extracted}건 (header ${header_skip}, empty ${empty_skip}, wrong month ${wrong_month_skip})`)
}

console.log(`\n=== TOTAL: ${allTxs.length}건 ===`)

const sales = allTxs.filter(t => t.amount > 0)
const expenses = allTxs.filter(t => t.amount < 0)
console.log(`매출 (amount>0): ${sales.length}건 / ${sales.reduce((s, t) => s + t.amount, 0).toLocaleString()}원`)
console.log(`지출 (amount<0): ${expenses.length}건 / ${expenses.reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString()}원`)

// 월별
const byMonth = {}
for (const t of allTxs) {
  const ym = t.date.slice(0, 7)
  if (!byMonth[ym]) byMonth[ym] = { count: 0, rev: 0, exp: 0 }
  byMonth[ym].count++
  if (t.amount > 0) byMonth[ym].rev += t.amount
  else byMonth[ym].exp += Math.abs(t.amount)
}
console.log('\n월별:')
for (const m of Object.keys(byMonth).sort()) {
  const v = byMonth[m]
  console.log(`  ${m}: ${v.count}건 | 매출 ${v.rev.toLocaleString()}원 | 지출 ${v.exp.toLocaleString()}원`)
}

writeFileSync('scripts/full-xlsx-v2-extracted.json', JSON.stringify(allTxs, null, 2), 'utf8')
console.log(`\n✓ scripts/full-xlsx-v2-extracted.json 저장`)
