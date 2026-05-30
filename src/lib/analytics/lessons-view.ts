/**
 * 통합 수업 뷰 — 일/주/월 그룹핑 순수 함수.
 */
import type { UnifiedLesson } from '@/lib/supabase/lessons-combined'

export type ViewMode = '일별' | '주별' | '월별'

export function getRangeForView(mode: ViewMode, anchor: string): { start: string; end: string } {
  const [y, m, d] = anchor.split('-').map(Number)
  if (mode === '일별') {
    return { start: anchor, end: anchor }
  }
  if (mode === '주별') {
    // 일요일 기준 (한국 캘린더 관습) — 일요일이 주 시작
    const date = new Date(y, m - 1, d)
    const weekday = date.getDay()  // 0=일 ~ 6=토
    const sunday = new Date(date)
    sunday.setDate(d - weekday)
    const saturday = new Date(sunday)
    saturday.setDate(sunday.getDate() + 6)
    return { start: fmt(sunday), end: fmt(saturday) }
  }
  // 월별
  const lastDay = new Date(y, m, 0).getDate()
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay)}` }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 날짜별 그룹 — 주별 view에서 day column 만들 때 사용.
 */
export function groupByDate(lessons: UnifiedLesson[]): Map<string, UnifiedLesson[]> {
  const map = new Map<string, UnifiedLesson[]>()
  for (const l of lessons) {
    if (!map.has(l.date)) map.set(l.date, [])
    map.get(l.date)!.push(l)
  }
  return map
}

/**
 * 월별 view: 날짜별 건수 (개별 + 그룹 분리)
 */
export interface DayCount {
  date: string
  individual: number
  group: number
  total: number
}

export function countByDate(lessons: UnifiedLesson[]): Map<string, DayCount> {
  const map = new Map<string, DayCount>()
  for (const l of lessons) {
    if (!map.has(l.date)) {
      map.set(l.date, { date: l.date, individual: 0, group: 0, total: 0 })
    }
    const c = map.get(l.date)!
    if (l.type === 'individual') c.individual++
    else c.group++
    c.total++
  }
  return map
}

/**
 * 한 주의 일요일 ~ 토요일 7일 date string 배열.
 */
export function getWeekDates(weekStart: string): string[] {
  const [y, m, d] = weekStart.split('-').map(Number)
  const dates: string[] = []
  const date = new Date(y, m - 1, d)
  for (let i = 0; i < 7; i++) {
    dates.push(fmt(date))
    date.setDate(date.getDate() + 1)
  }
  return dates
}

/**
 * 월별 캘린더 그리드 — Sunday-first 6 weeks.
 */
export function buildMonthGrid(yearMonth: string): Array<{ date: string | null }[]> {
  const [y, m] = yearMonth.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0).getDate()
  const startWeekday = first.getDay()

  const cells: { date: string | null }[] = []
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null })
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ date: `${y}-${pad(m)}-${pad(d)}` })
  }
  while (cells.length % 7 !== 0) cells.push({ date: null })

  const rows: Array<{ date: string | null }[]> = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

/**
 * 일별 view: 시간순 정렬 + 시간대 라벨 추가용
 */
export function sortByTime(lessons: UnifiedLesson[]): UnifiedLesson[] {
  return [...lessons].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
}

/**
 * 수업 종류 라벨 — passName 또는 sessionName 기반
 */
export function lessonTypeLabel(l: UnifiedLesson): string {
  if (l.type === 'group') return `그룹 · ${l.sessionName ?? '세션'}`
  return l.passName ?? '개인'
}
