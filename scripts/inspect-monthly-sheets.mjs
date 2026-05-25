import XLSX from 'xlsx'

const FILE = 'C:/Users/leech/Downloads/지출.xlsx'
const wb = XLSX.readFile(FILE)

const targetSheets = ['2026 1월 지출', '2026 2월 지출', '2026 3월 지출', '2026 4월 지출', '2026 5월 지출']

for (const name of targetSheets) {
  const ws = wb.Sheets[name]
  if (!ws) { console.log(`!! sheet [${name}] 없음`); continue }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  console.log(`\n=== [${name}] ${rows.length} rows ===`)
  console.log('Header:', rows[0])
  rows.slice(1, 6).forEach((r, i) => console.log(`  ${i + 1}:`, r))
  if (rows.length > 8) {
    console.log('  ...')
    rows.slice(-2).forEach((r, i) => console.log(`  ${rows.length - 2 + i}:`, r))
  }
}
