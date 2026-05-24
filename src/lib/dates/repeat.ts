/**
 * 시작일 ~ 종료일 사이에서 주어진 요일(0=일 … 6=토)에 해당하는 날짜를 모두 반환.
 * 둘 다 포함 (inclusive).
 */
export function generateRepeatDates(
  startDate: string,
  endDate: string,
  weekdays: number[],   // 0=일, 1=월 … 6=토
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return []
  }
  if (startDate > endDate) return []
  if (weekdays.length === 0) return []
  const weekdaySet = new Set(weekdays)

  const result: string[] = []
  // Local-date parsing (no TZ shift)
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)

  // 안전 가드: 1년치 이상은 막음
  const MAX_DAYS = 366 * 2
  const daysSpan = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (daysSpan > MAX_DAYS) return []

  const cursor = new Date(start)
  while (cursor <= end) {
    if (weekdaySet.has(cursor.getDay())) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      result.push(`${y}-${m}-${d}`)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
