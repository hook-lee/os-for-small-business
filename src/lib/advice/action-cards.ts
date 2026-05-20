import type { Transaction, ActionCard } from '@/types/domain'
import { differenceInCalendarDays } from 'date-fns'
import { getUpcomingDueDates } from '@/lib/tax/due-dates'

interface ActionCardContext {
  noranusanContribution?: number
  isYoungStartupSet?: boolean
}

const NORANUSAN_ANNUAL_LIMIT = 5_000_000
const WEDDING_LOOKBACK_DAYS = 30
const VAT_PREP_WINDOW_DAYS = 7

export function getActionCards(
  transactions: Transaction[],
  today: string,
  context: ActionCardContext = {},
): ActionCard[] {
  const now = new Date(today)

  // 1. Young startup reduction
  const youngStartup: ActionCard = {
    id: 'young-startup-uncfgd',
    title: '🎯 청년창업감면 설정 필요',
    description: '만 34세 이하 + 필라테스업 + 2024 창업 = 5년간 종합소득세 50~100% 감면. 설정 페이지에서 토글하세요.',
    estimatedSavings: undefined,
    category: 'deduction',
    triggered: context.isYoungStartupSet === false || context.isYoungStartupSet === undefined,
  }

  // 2. Business card priority — always shown
  const bizCard: ActionCard = {
    id: 'business-card-priority',
    title: '사업용 신용카드로 몰아쓰기',
    description: '국세청 홈택스에 사업용 카드를 등록하면 결제분이 자동 집계되어 부가세 매입세액 공제(10%) + 종소세 필요경비 인정.',
    estimatedSavings: undefined,
    category: 'general',
    triggered: true,
  }

  // 3. Utility business account
  const utility: ActionCard = {
    id: 'utility-business-acct',
    title: '공과금 사업자용 전환 + 세금계산서 발행',
    description: '전기·가스·인터넷·휴대폰을 사업자 등록번호로 전환하면 매달 부가세 10% 환급 + 종소세 경비 인정.',
    estimatedSavings: undefined,
    category: 'general',
    triggered: true,
  }

  // 4. Wedding evidence — recent 경조사비
  const recentWedding = transactions.find(tx => {
    if (tx.category !== '경조사비') return false
    const txDate = new Date(tx.date)
    const days = differenceInCalendarDays(now, txDate)
    return days >= 0 && days <= WEDDING_LOOKBACK_DAYS
  })
  const wedding: ActionCard = {
    id: 'wedding-evidence',
    title: '경조사비 청첩장·부고장 챙기셨나요?',
    description: '경조사비는 청첩장·부고장 등 증빙이 있으면 건당 20만원까지 사회통념상 비용으로 인정됩니다. 사진으로 보관해두세요.',
    estimatedSavings: undefined,
    category: 'evidence',
    triggered: !!recentWedding,
  }

  // 5. Noranusan room
  const contributed = context.noranusanContribution ?? 0
  const room = NORANUSAN_ANNUAL_LIMIT - contributed
  const noranusan: ActionCard = {
    id: 'noranusan-room',
    title: `노란우산 한도 ${Math.round(room / 10_000)}만원 남음`,
    description: `연 ${NORANUSAN_ANNUAL_LIMIT.toLocaleString()}원까지 소득공제. 사업소득 구간에 따라 15~24% 절세 효과.`,
    estimatedSavings: room > 0 ? Math.round(room * 0.20) : undefined,
    category: 'deduction',
    triggered: room > 500_000,
  }

  // 6. VAT prep within D-7
  const dues = getUpcomingDueDates(today)
  const nextVAT = dues.find(d => d.type === 'VAT')
  const vatPrep: ActionCard = {
    id: 'vat-prep',
    title: `부가세 신고 D-${nextVAT?.daysRemaining ?? '?'}`,
    description: '신고 자료 미리 정리: 매출/매입 엑셀 다운로드 → 세무사 전달.',
    estimatedSavings: undefined,
    category: 'preparation',
    triggered: !!nextVAT && nextVAT.daysRemaining <= VAT_PREP_WINDOW_DAYS,
  }

  return [youngStartup, bizCard, utility, wedding, noranusan, vatPrep]
}
