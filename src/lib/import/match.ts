import type { ImportColumn } from './schema'

/**
 * 헤더 정규화: 소문자 + 공백·구분기호 제거. 매칭 비교용.
 * "전화 번호" / "전화_번호" / "Phone-Number" → 비교 가능한 형태로.
 */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[\s_\-()[\].,/·:|#]+/g, '')
    .trim()
}

/**
 * 업로드된 CSV의 헤더들을 우리 표준 컬럼에 best-guess 매핑.
 * 반환: { 우리컬럼명: 매칭된 CSV헤더 | null }
 *
 * 2단계: ① 정확(정규화) 일치 우선 → ② 남은 것만 부분 포함.
 * 한 CSV 헤더는 한 컬럼에만 배정(중복 방지).
 */
export function guessMapping(csvHeaders: string[], columns: ImportColumn[]): Record<string, string | null> {
  const used = new Set<string>()
  const result: Record<string, string | null> = {}
  const normCsv = csvHeaders.map(h => ({ raw: h, norm: normalizeHeader(h) }))

  // ① 정확 일치 (표준명 또는 별칭)
  for (const col of columns) {
    const cands = [col.header, ...(col.aliases ?? [])].map(normalizeHeader)
    const hit = normCsv.find(c => !used.has(c.raw) && c.norm !== '' && cands.includes(c.norm))
    result[col.header] = hit ? hit.raw : null
    if (hit) used.add(hit.raw)
  }

  // ② 부분 포함 (아직 매칭 안 된 컬럼만). 짧은(<2) 후보는 오매칭 방지로 제외.
  for (const col of columns) {
    if (result[col.header]) continue
    const cands = [col.header, ...(col.aliases ?? [])].map(normalizeHeader).filter(c => c.length >= 2)
    const hit = normCsv.find(c =>
      !used.has(c.raw) && c.norm.length >= 2 &&
      cands.some(cand => c.norm.includes(cand) || cand.includes(c.norm)),
    )
    if (hit) { result[col.header] = hit.raw; used.add(hit.raw) }
  }

  return result
}

/**
 * 매핑(우리컬럼 → CSV헤더)을 적용해 원본 행들을 '표준 컬럼명' 기준 행으로 변환.
 * 매핑 안 된 컬럼은 빈 문자열.
 */
export function applyMapping(
  rows: Record<string, string>[],
  columns: ImportColumn[],
  mapping: Record<string, string>,   // 우리컬럼 → CSV헤더 ('' = 없음)
): Record<string, string>[] {
  return rows.map(row => {
    const out: Record<string, string> = {}
    for (const col of columns) {
      const src = mapping[col.header]
      out[col.header] = src ? (row[src] ?? '') : ''
    }
    return out
  })
}
