import type { DueDate } from '@/types/domain'
import { differenceInCalendarDays } from 'date-fns'

const VAT_DATES: Array<{ label: string; mmdd: string }> = [
  { label: '부가세 (전년 2기 확정)', mmdd: '01-25' },
  { label: '부가세 (1기 예정)',       mmdd: '04-25' },
  { label: '부가세 (1기 확정)',       mmdd: '07-25' },
  { label: '부가세 (2기 예정)',       mmdd: '10-25' },
]
const INCOME_TAX_MMDD = '05-31'

export function getUpcomingDueDates(today: string): DueDate[] {
  const now = new Date(today)
  const thisYear = now.getFullYear()
  const dues: DueDate[] = []

  for (const v of VAT_DATES) {
    const date = `${thisYear}-${v.mmdd}`
    const days = differenceInCalendarDays(new Date(date), now)
    if (days >= 0) dues.push({ type: 'VAT', label: v.label, date, daysRemaining: days })
  }

  const itDate = `${thisYear}-${INCOME_TAX_MMDD}`
  const itDays = differenceInCalendarDays(new Date(itDate), now)
  if (itDays >= 0) {
    dues.push({ type: 'INCOME_TAX', label: '종합소득세', date: itDate, daysRemaining: itDays })
  }

  // 당해 부가세 모두 지났으면 다음 해 1/25 추가
  if (dues.filter(d => d.type === 'VAT').length === 0) {
    const nextVAT = `${thisYear + 1}-01-25`
    const nextDays = differenceInCalendarDays(new Date(nextVAT), now)
    if (nextDays >= 0) {
      dues.push({
        type: 'VAT',
        label: '부가세 (당해 2기 확정)',
        date: nextVAT,
        daysRemaining: nextDays,
      })
    }
  }

  return dues.sort((a, b) => a.daysRemaining - b.daysRemaining)
}
