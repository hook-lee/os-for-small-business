import type { DueDate } from '@/types/domain'
import { differenceInCalendarDays } from 'date-fns'

type TaxPayerType = 'general' | 'simplified'

// 일반과세자(개인): 예정고지(4·10월) + 확정신고(1·7월).
const VAT_DATES_GENERAL: Array<{ label: string; mmdd: string }> = [
  { label: '부가세 (전년 2기 확정)', mmdd: '01-25' },
  { label: '부가세 (1기 예정고지)',   mmdd: '04-25' },
  { label: '부가세 (1기 확정)',       mmdd: '07-25' },
  { label: '부가세 (2기 예정고지)',   mmdd: '10-25' },
]

// 간이과세자: 1년 1회 확정신고(1.25) + 7월 예정부과(직전 납부세액 1/2, 50만 미만 면제).
const VAT_DATES_SIMPLIFIED: Array<{ label: string; mmdd: string }> = [
  { label: '부가세 (전년도 확정신고)', mmdd: '01-25' },
  { label: '부가세 (예정부과)',         mmdd: '07-25' },
]

const INCOME_TAX_MMDD = '05-31'

export function getUpcomingDueDates(today: string, taxPayerType: TaxPayerType = 'general'): DueDate[] {
  const now = new Date(today)
  const thisYear = now.getFullYear()
  const dues: DueDate[] = []

  const vatDates = taxPayerType === 'simplified' ? VAT_DATES_SIMPLIFIED : VAT_DATES_GENERAL
  for (const v of vatDates) {
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
        label: taxPayerType === 'simplified' ? '부가세 (당해년도 확정신고)' : '부가세 (당해 2기 확정)',
        date: nextVAT,
        daysRemaining: nextDays,
      })
    }
  }

  return dues.sort((a, b) => a.daysRemaining - b.daysRemaining)
}
