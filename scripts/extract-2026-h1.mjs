import XLSX from 'xlsx'

const FILE = 'C:/Users/leech/Downloads/지출.xlsx'
const wb = XLSX.readFile(FILE)

const monthSheets = [
  { name: '2026 1월 지출', month: 1 },
  { name: '2026 2월 지출', month: 2 },
  { name: '2026 3월 지출', month: 3 },
  { name: '2026 4월 지출', month: 4 },
  { name: '2026 5월 지출', month: 5 },
]

function excelDateToString(serial) {
  if (typeof serial !== 'number' || serial < 25569) return null
  const ms = (serial - 25569) * 86400 * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const allTxs = []

for (const { name, month } of monthSheets) {
  const ws = wb.Sheets[name]
  if (!ws) { console.log(`!! ${name} 없음`); continue }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

  // 첫 row는 헤더
  // 구조: No, 날짜, 계정과목, 금액, 수단, 금액(누계?), 비고, 비고2, 항목, 정산, 정산비고
  const COL = { no: 0, date: 1, category: 2, amount: 3, method: 4, memo: 6, memo2: 7 }

  let extracted = 0
  let skippedHeader = 0
  let skippedEmpty = 0

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.every(v => v === null)) { skippedEmpty++; continue }
    const cat = r[COL.category]
    if (!cat) { skippedEmpty++; continue }
    // "N월 종합" 같은 헤더성
    if (typeof cat === 'string' && /^\d{1,2}월\s*종합/.test(cat.trim())) {
      skippedHeader++
      continue
    }
    const dateStr = excelDateToString(r[COL.date])
    if (!dateStr) { skippedEmpty++; continue }
    // 시트 월과 날짜 월이 다르면 스킵 (잘못 들어간 row)
    const rowMonth = parseInt(dateStr.slice(5, 7), 10)
    if (rowMonth !== month) {
      console.log(`  [${name}] 다른 월 row 스킵: ${dateStr} ${cat}`)
      continue
    }
    const amount = Number(r[COL.amount])
    if (!Number.isFinite(amount) || amount === 0) { skippedEmpty++; continue }

    allTxs.push({
      date: dateStr,
      category: String(cat).trim(),
      amount,
      method: r[COL.method] ? String(r[COL.method]).trim() : null,
      memo: r[COL.memo] ? String(r[COL.memo]).trim() : null,
      counterparty: r[COL.memo2] ? String(r[COL.memo2]).trim() : null,
    })
    extracted++
  }
  console.log(`[${name}] 추출 ${extracted}건 (skipped header ${skippedHeader}, empty ${skippedEmpty})`)
}

console.log(`\n=== TOTAL: ${allTxs.length} rows ===`)
const sales = allTxs.filter(t => t.amount > 0)
const expenses = allTxs.filter(t => t.amount < 0)
console.log(`매출: ${sales.length}건, 합계 ${sales.reduce((s, t) => s + t.amount, 0).toLocaleString()}원`)
console.log(`지출: ${expenses.length}건, 합계 ${expenses.reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString()}원`)

// 월별 분포
const byMonth = {}
for (const t of allTxs) {
  const ym = t.date.slice(0, 7)
  byMonth[ym] = (byMonth[ym] || 0) + 1
}
console.log('\n월별:')
for (const m of Object.keys(byMonth).sort()) console.log(`  ${m}: ${byMonth[m]}건`)

// 카테고리별 (전체)
const byCat = {}
for (const t of allTxs) byCat[t.category] = (byCat[t.category] || 0) + 1
console.log('\n카테고리별 (전체):')
Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => {
  console.log(`  ${cat}: ${n}건`)
})

// 수단별
const byMethod = {}
for (const t of allTxs) byMethod[t.method ?? '(없음)'] = (byMethod[t.method ?? '(없음)'] || 0) + 1
console.log('\n수단:')
for (const [m, n] of Object.entries(byMethod)) console.log(`  ${m}: ${n}건`)

// JSON 저장
import { writeFileSync } from 'node:fs'
writeFileSync('scripts/2026-h1-extracted.json', JSON.stringify(allTxs, null, 2), 'utf8')
console.log(`\n✓ scripts/2026-h1-extracted.json 저장 완료 (${allTxs.length}건)`)
