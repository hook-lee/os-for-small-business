import XLSX from 'xlsx'

const FILE = 'C:/Users/leech/Downloads/지출 (1).xlsx'
const wb = XLSX.readFile(FILE)

// 2026 5월 지출 시트 자세히 보기 (좌/우 구조 + 요약 + 세금)
const ws = wb.Sheets['2026 5월 지출']
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

console.log(`=== [2026 5월 지출] ${rows.length} rows ===`)
// 헤더 + 처음 30개 row 미리보기
rows.slice(0, 30).forEach((r, i) => {
  // null만 있는 row는 skip
  if (r.every(v => v === null)) return
  console.log(`  ${i}:`, r)
})
