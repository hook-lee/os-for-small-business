import XLSX from 'xlsx'

const FILE = 'C:/Users/leech/Downloads/지출.xlsx'
const wb = XLSX.readFile(FILE)
const ws = wb.Sheets['전체 통합']
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

const header = rows[0]
console.log('Header:', header)

const COL = {
  no: header.indexOf('No.'),
  yearMonth: header.indexOf('연월'),
  date: header.indexOf('날짜'),
  category: header.indexOf('계정과목'),
  amount: header.indexOf('금액'),
  method: header.indexOf('수단'),
  amount2: header.indexOf('금액2'),
  memo: header.indexOf('비고'),
  memo2: header.indexOf('비고2'),
}

function excelDateToString(serial) {
  if (typeof serial !== 'number') return null
  // Excel epoch: 1900-01-01 (1), but with 1900 leap year bug = serial 60 missing
  // Standard formula: ms = (serial - 25569) * 86400 * 1000
  const ms = (serial - 25569) * 86400 * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

const targetMonths = new Set(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'])
const target = []

for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  const ym = r[COL.yearMonth]
  if (!targetMonths.has(ym)) continue
  const dateStr = excelDateToString(r[COL.date])
  if (!dateStr) continue
  target.push({
    date: dateStr,
    ym,
    category: r[COL.category],
    amount: Number(r[COL.amount]) || 0,
    method: r[COL.method],
    memo: r[COL.memo],
    memo2: r[COL.memo2],
  })
}

console.log(`\n=== 2026 1-5월 row 수: ${target.length} ===`)

// 매출 / 지출 카운트
const sales = target.filter(t => t.amount > 0)
const expenses = target.filter(t => t.amount < 0)
console.log(`매출 (amount > 0): ${sales.length} rows, 합계 ${sales.reduce((s, t) => s + t.amount, 0).toLocaleString()}원`)
console.log(`지출 (amount < 0): ${expenses.length} rows, 합계 ${expenses.reduce((s, t) => s + Math.abs(t.amount), 0).toLocaleString()}원`)
console.log(`0원: ${target.filter(t => t.amount === 0).length} rows`)

// 월별 분포
const byMonth = {}
for (const t of target) {
  byMonth[t.ym] = (byMonth[t.ym] || 0) + 1
}
console.log('\n월별 분포:')
for (const m of Object.keys(byMonth).sort()) console.log(`  ${m}: ${byMonth[m]}건`)

// 카테고리별 분포
const byCat = {}
for (const t of target) {
  byCat[t.category] = (byCat[t.category] || 0) + 1
}
console.log('\n카테고리별 (상위 15):')
Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([cat, n]) => {
  console.log(`  ${cat}: ${n}건`)
})

// 수단별
const byMethod = {}
for (const t of target) {
  byMethod[t.method] = (byMethod[t.method] || 0) + 1
}
console.log('\n수단별:')
for (const [m, n] of Object.entries(byMethod)) console.log(`  ${m}: ${n}건`)

// 매출 샘플
console.log('\n=== 매출 샘플 5건 ===')
sales.slice(0, 5).forEach(s => console.log(' ', JSON.stringify(s)))

// 지출 샘플
console.log('\n=== 지출 샘플 5건 ===')
expenses.slice(0, 5).forEach(s => console.log(' ', JSON.stringify(s)))
