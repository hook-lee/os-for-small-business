/**
 * 기간 선택 유틸 — 강사 성과 비교 등 "이번달/이번분기/올해/누적" 토글용.
 *
 * 모든 날짜는 ISO 'YYYY-MM-DD'. 반환 범위는 [start, end] 양끝 포함.
 * 'all' = 누적 = 필터 없음 → null 반환 (호출부에서 "전체"로 처리).
 * 그 외는 항상 [기간 시작일, today] (= period-to-date). 미래는 데이터가 없으므로 end=today로 충분.
 */
export type PeriodKey = 'month' | 'quarter' | 'year' | 'all'

export interface PeriodRange {
  start: string
  end: string
}

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  month: '이번달',
  quarter: '이번분기',
  year: '올해',
  all: '누적',
}

export function isPeriodKey(v: string | undefined | null): v is PeriodKey {
  return v === 'month' || v === 'quarter' || v === 'year' || v === 'all'
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * @param key  기간 종류
 * @param today 'YYYY-MM-DD' 기준일
 * @returns {start,end} 또는 null('all')
 */
export function resolvePeriod(key: PeriodKey, today: string): PeriodRange | null {
  if (key === 'all') return null
  const year = today.slice(0, 4)
  const month = parseInt(today.slice(5, 7), 10) // 1~12

  if (key === 'year') {
    return { start: `${year}-01-01`, end: today }
  }
  if (key === 'month') {
    return { start: `${year}-${pad2(month)}-01`, end: today }
  }
  // quarter: 1~3 / 4~6 / 7~9 / 10~12
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1
  return { start: `${year}-${pad2(quarterStartMonth)}-01`, end: today }
}

function lastDayOfMonth(year: number, month: number): number {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) return 29
  return days[month - 1]
}

/**
 * resolvePeriod의 '월말/분기말/연말까지' 버전.
 * resolvePeriod는 end=today(period-to-date) — 매출처럼 "오늘까지 발생한 것"에 맞다.
 * 그러나 **폐강률**처럼 미래 일정까지 분모에 넣어야 하는 지표는 이 함수를 쓴다.
 *  - 폐강은 보통 다가오는(미래) 수업을 닫는 사건이라 end=today면 누락된다.
 */
export function resolvePeriodFull(key: PeriodKey, today: string): PeriodRange | null {
  if (key === 'all') return null
  const year = parseInt(today.slice(0, 4), 10)
  const month = parseInt(today.slice(5, 7), 10) // 1~12

  if (key === 'year') {
    return { start: `${year}-01-01`, end: `${year}-12-31` }
  }
  if (key === 'month') {
    return { start: `${year}-${pad2(month)}-01`, end: `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}` }
  }
  const qStart = Math.floor((month - 1) / 3) * 3 + 1
  const qEnd = qStart + 2
  return { start: `${year}-${pad2(qStart)}-01`, end: `${year}-${pad2(qEnd)}-${pad2(lastDayOfMonth(year, qEnd))}` }
}

/**
 * 'YYYY-MM-DD' 날짜가 기간 범위 안인지. range=null이면 항상 true(누적).
 * date가 null/빈값이면(시점 불명) 기간 필터 시 false, 누적 시 true.
 */
export function isInPeriod(date: string | null | undefined, range: PeriodRange | null): boolean {
  if (range === null) return true
  if (!date) return false
  const d = date.slice(0, 10)
  return d >= range.start && d <= range.end
}
