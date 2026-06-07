/**
 * 수강권 정지(일시정지) 순수 계산.
 *  - 정지 일수 = 시작~종료 포함 일수 (5/1~5/8 = 8일).
 *  - 만료일 연장 = 정지 일수.
 *  - 정지중 = 오늘이 어떤 정지 구간의 [start, end] 안.
 *  - 누적 정지일수 = 모든 정지 days 합 → 센터 최대치와 비교.
 * DB 의존 없는 pure 함수 (단위 테스트 가능).
 */

export interface Suspension {
  id: number
  passId: number
  startDate: string   // yyyy-mm-dd
  endDate: string     // yyyy-mm-dd
  days: number
  reason: string | null
  createdAt: string
}

const DAY_MS = 86_400_000

/** 시작~종료 포함 일수. end < start면 0 이하. */
export function inclusiveDays(startDate: string, endDate: string): number {
  const s = new Date(startDate + 'T00:00:00')
  const e = new Date(endDate + 'T00:00:00')
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0
  return Math.floor((e.getTime() - s.getTime()) / DAY_MS) + 1
}

/** 날짜에 N일 더하기 (yyyy-mm-dd). */
export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 오늘 기준 현재 정지중인 구간 (없으면 null). */
export function currentSuspension(suspensions: Suspension[], today: string): Suspension | null {
  return suspensions.find(s => s.startDate <= today && today <= s.endDate) ?? null
}

/** 누적 정지 일수 (전체 이력 합). */
export function totalSuspendDays(suspensions: Suspension[]): number {
  return suspensions.reduce((sum, s) => sum + (s.days || 0), 0)
}

/** 남은 정지 가능 일수. maxDays=0이면 무제한(Infinity). */
export function remainingSuspendDays(suspensions: Suspension[], maxDays: number): number {
  if (!maxDays || maxDays <= 0) return Infinity
  return Math.max(0, maxDays - totalSuspendDays(suspensions))
}
