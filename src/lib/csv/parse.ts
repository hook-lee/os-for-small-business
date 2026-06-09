/**
 * 외부 의존성 없는 견고한 CSV 파서.
 * 처리: 따옴표 필드("a,b"), 따옴표 내 콤마·줄바꿈, "" 이스케이프, CRLF, 선행 BOM.
 */
export function parseCSV(input: string): string[][] {
  let text = input
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // BOM 제거

  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } // "" → 리터럴 "
        else inQuotes = false
      } else {
        field += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* CRLF의 \r 무시, \n에서 행 종료 */ }
      else field += c
    }
  }
  // 마지막 필드/행 flush (파일이 개행으로 안 끝난 경우)
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

export interface ParsedCSV {
  headers: string[]
  rows: Record<string, string>[]
}

/**
 * 첫 행을 헤더로, 나머지를 객체 배열로 변환.
 * - 모든 셀이 빈 행은 제외
 * - 헤더·셀 값은 trim
 */
export function csvToObjects(text: string): ParsedCSV {
  const raw = parseCSV(text).filter(r => r.some(c => c.trim() !== ''))
  if (raw.length === 0) return { headers: [], rows: [] }
  const headers = raw[0].map(h => h.trim())
  const rows = raw.slice(1).map(cells => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = (cells[idx] ?? '').trim() })
    return obj
  })
  return { headers, rows }
}
