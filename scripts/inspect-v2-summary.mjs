import XLSX from 'xlsx'

const FILE = 'C:/Users/leech/Downloads/지출 (1).xlsx'
const wb = XLSX.readFile(FILE)

// 2026 5월 시트의 "항목" 컬럼 (8번째 = index 8) 데이터 수집 — 요약 영역
const ws = wb.Sheets['2026 5월 지출']
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

console.log('=== "항목" 컬럼 (요약 영역) ===')
const summaryItems = []
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]
  if (!r) continue
  const item = r[8]      // 항목
  const value = r[9]     // 정산
  const memo = r[10]     // 정산 비고
  if (item || value !== null) {
    summaryItems.push({ row: i, item, value, memo })
  }
}
console.log(`총 ${summaryItems.length}개 요약 항목`)
summaryItems.forEach(s => console.log(`  row ${s.row}: ${s.item} = ${s.value} (${s.memo ?? ''})`))
