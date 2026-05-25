import XLSX from 'xlsx'

const FILE = 'C:/Users/leech/Downloads/지출.xlsx'
const wb = XLSX.readFile(FILE)

console.log('=== Sheets ===')
console.log(wb.SheetNames)
console.log()

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  console.log(`\n=== [${name}] (${rows.length} rows) ===`)
  // 처음 5 + 마지막 3 row 미리보기
  rows.slice(0, 8).forEach((r, i) => console.log(`  ${i}:`, r))
  if (rows.length > 11) {
    console.log('  ...')
    rows.slice(-3).forEach((r, i) => console.log(`  ${rows.length - 3 + i}:`, r))
  }
}
