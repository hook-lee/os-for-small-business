import XLSX from 'xlsx'

const FILE = 'C:/Users/leech/Downloads/지출 (1).xlsx'
const wb = XLSX.readFile(FILE)

console.log('=== Sheets ===')
console.log(wb.SheetNames)

// 우선 1개 월별 시트 자세히
for (const name of wb.SheetNames.slice(0, 3)) {
  const ws = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  console.log(`\n========= [${name}] ${rows.length} rows ============`)
  // 처음 20개 row 미리보기
  rows.slice(0, 20).forEach((r, i) => console.log(`  ${i}:`, r))
}
