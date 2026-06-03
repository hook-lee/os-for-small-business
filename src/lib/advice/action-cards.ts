import type { Transaction, ActionCard } from '@/types/domain'
import { differenceInCalendarDays } from 'date-fns'
import { getUpcomingDueDates } from '@/lib/tax/due-dates'

interface ActionCardContext {
  noranusanContribution?: number
  isYoungStartupSet?: boolean
  /** 권장 월 예비비 (recommendReserve.monthly). 적립 부족 점검용. */
  recommendedMonthlyReserve?: number
  /** 종소세 예상 (국세+지방세). 청년창업감면 잠재 절세액 표시용. */
  incomeTaxEstimate?: number
  /** 간이/일반 — 부가세 매입공제 안내 분기용 (일반만 매입세액 공제). */
  taxPayerType?: 'general' | 'simplified'
}

const NORANUSAN_ANNUAL_LIMIT = 5_000_000
const WEDDING_LOOKBACK_DAYS = 30
const VAT_PREP_WINDOW_DAYS = 7
const RESERVE_GAP_THRESHOLD = 300_000   // 예비비 부족 경고 최소 금액
const CARD_RATIO_THRESHOLD = 0.7        // 카드 결제 비중 이하면 안내

const man = (won: number) => Math.round(won / 10_000).toLocaleString()

/**
 * 절세·운영 액션 카드. 가능한 한 원장의 '실제 데이터'에서 트리거·금액을 뽑아낸다.
 * (제네릭 안내가 아니라 그 원장 장부에 맞는 카드만 triggered 되도록.)
 */
export function getActionCards(
  transactions: Transaction[],
  today: string,
  context: ActionCardContext = {},
): ActionCard[] {
  const now = new Date(today)
  const year = today.slice(0, 4)
  const monthsElapsed = Math.max(1, parseInt(today.slice(5, 7), 10))

  // ── 올해 장부에서 실측치 집계 ──
  let businessExpenseTotal = 0
  let cardBusinessExpense = 0
  let reserveYTD = 0
  for (const tx of transactions) {
    if (!tx.date.startsWith(year)) continue
    if (tx.classification === 'reserve' && tx.amount < 0) {
      reserveYTD += Math.abs(tx.amount)
      continue
    }
    if (tx.amount < 0 && tx.classification === 'business') {
      const abs = Math.abs(tx.amount)
      businessExpenseTotal += abs
      if (tx.method === '카드') cardBusinessExpense += abs
    }
  }
  const cardRatio = businessExpenseTotal > 0 ? cardBusinessExpense / businessExpenseTotal : 1
  const hasActivity = businessExpenseTotal > 0

  // 1. 청년창업감면 — 미설정 시 잠재 절세액(종소세 전액 가능)을 함께 표시
  const incomeTax = context.incomeTaxEstimate ?? 0
  const youngStartup: ActionCard = {
    id: 'young-startup-uncfgd',
    title: '🎯 청년창업감면 설정 필요',
    description: incomeTax > 0
      ? `만 34세 이하 + 필라테스업 + 2024 창업이면 5년간 종합소득세 50~100% 감면. 올해 예상 종소세 ${man(incomeTax)}만원 중 최대 전액까지 줄어들 수 있어요. 설정에서 토글하세요.`
      : '만 34세 이하 + 필라테스업 + 2024 창업 = 5년간 종합소득세 50~100% 감면. 설정 페이지에서 토글하세요.',
    estimatedSavings: incomeTax > 0 ? incomeTax : undefined,
    category: 'deduction',
    triggered: context.isYoungStartupSet === false || context.isYoungStartupSet === undefined,
  }

  // 2. 예비비 적립 부족 — 권장 적립액 대비 실제 적립 비교 (데이터 기반)
  const recMonthly = context.recommendedMonthlyReserve ?? 0
  const expectedReserve = recMonthly * monthsElapsed
  const reserveGap = expectedReserve - reserveYTD
  const reserveCard: ActionCard = {
    id: 'reserve-shortfall',
    title: `예비비 ${man(reserveGap)}만원 부족`,
    description: `올해 권장 세금 적립 ${man(expectedReserve)}만원 중 ${man(reserveYTD)}만원만 적립됐어요. 신고 때 현금이 부족하지 않게 매달 ${man(recMonthly)}만원씩 '예비비'로 빼두세요.`,
    estimatedSavings: undefined,
    category: 'preparation',
    triggered: recMonthly > 0 && reserveGap > RESERVE_GAP_THRESHOLD,
  }

  // 3. 사업용 카드 집중 — 카드 결제 비중이 낮을 때만 (데이터 기반)
  const nonCard = businessExpenseTotal - cardBusinessExpense
  const cardCard: ActionCard = {
    id: 'business-card-priority',
    title: `사업비 카드 결제 비중 ${(cardRatio * 100).toFixed(0)}%`,
    description: context.taxPayerType === 'simplified'
      ? `사업 비용 ${man(businessExpenseTotal)}만원 중 카드 외 결제가 ${man(nonCard)}만원이에요. 사업용 카드·세금계산서로 결제하면 종소세 필요경비로 인정돼 소득세가 줄어듭니다.`
      : `사업 비용 ${man(businessExpenseTotal)}만원 중 카드 외 결제가 ${man(nonCard)}만원이에요. 사업용 카드로 몰면 부가세 매입세액 공제(10%) + 종소세 경비 인정.`,
    estimatedSavings: context.taxPayerType === 'simplified' ? undefined : (nonCard > 0 ? Math.round(nonCard * 0.10) : undefined),
    category: 'general',
    triggered: hasActivity && cardRatio < CARD_RATIO_THRESHOLD,
  }

  // 4. 경조사비 증빙 — 최근 경조사비 거래가 있을 때
  const recentWedding = transactions.find(tx => {
    if (tx.category !== '경조사비') return false
    const days = differenceInCalendarDays(now, new Date(tx.date))
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

  // 5. 노란우산 한도 — 실제 납입액 기준 잔여 공제 여력
  const contributed = context.noranusanContribution ?? 0
  const room = NORANUSAN_ANNUAL_LIMIT - contributed
  const noranusan: ActionCard = {
    id: 'noranusan-room',
    title: `노란우산 한도 ${man(room)}만원 남음`,
    description: `연 ${NORANUSAN_ANNUAL_LIMIT.toLocaleString()}원까지 소득공제. 사업소득 구간에 따라 15~24% 절세 효과. 폐업·노후 대비도 됩니다.`,
    estimatedSavings: room > 0 ? Math.round(room * 0.20) : undefined,
    category: 'deduction',
    triggered: room > 500_000,
  }

  // 6. 부가세 신고 D-7
  const dues = getUpcomingDueDates(today, context.taxPayerType ?? 'general')
  const nextVAT = dues.find(d => d.type === 'VAT')
  const vatPrep: ActionCard = {
    id: 'vat-prep',
    title: `부가세 신고 D-${nextVAT?.daysRemaining ?? '?'}`,
    description: '신고 자료 미리 정리: 매출/매입 엑셀 다운로드 → 세무사 전달.',
    estimatedSavings: undefined,
    category: 'preparation',
    triggered: !!nextVAT && nextVAT.daysRemaining <= VAT_PREP_WINDOW_DAYS,
  }

  // 7. 공과금 사업자 전환 — 사업 활동(비용)이 있는 원장에게만 1회성 안내
  const utility: ActionCard = {
    id: 'utility-business-acct',
    title: '공과금 사업자용 전환 + 세금계산서 발행',
    description: '전기·가스·인터넷·휴대폰을 사업자 등록번호로 전환하면 매달 부가세 10% 환급 + 종소세 경비 인정.',
    estimatedSavings: undefined,
    category: 'general',
    triggered: hasActivity && context.taxPayerType !== 'simplified',
  }

  return [youngStartup, reserveCard, cardCard, wedding, noranusan, vatPrep, utility]
}
