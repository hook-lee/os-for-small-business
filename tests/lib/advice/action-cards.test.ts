import { describe, it, expect } from 'vitest'
import { getActionCards } from '@/lib/advice/action-cards'
import type { Transaction, Category, PaymentMethod, TxClassification } from '@/types/domain'

function tx(
  date: string,
  category: Category,
  amount: number,
  method: PaymentMethod = '카드',
  classification: TxClassification = 'business',
): Transaction {
  return {
    date,
    rawCategory: category,
    category,
    amount,
    method,
    counterparty: undefined,
    person: undefined,
    classification,
    memo: undefined,
  }
}

describe('getActionCards', () => {
  it('isYoungStartupSet=false이면 young-startup 카드 trigger', () => {
    const cards = getActionCards([], '2026-03-01', { isYoungStartupSet: false })
    const card = cards.find(c => c.id === 'young-startup-uncfgd')!
    expect(card.triggered).toBe(true)
    expect(card.category).toBe('deduction')
  })

  it('isYoungStartupSet=true이면 young-startup 카드 untriggered', () => {
    const cards = getActionCards([], '2026-03-01', { isYoungStartupSet: true })
    const card = cards.find(c => c.id === 'young-startup-uncfgd')!
    expect(card.triggered).toBe(false)
  })

  it('청년창업 미설정 + 종소세 예상 있으면 estimatedSavings = 예상 종소세', () => {
    const cards = getActionCards([], '2026-03-01', { isYoungStartupSet: false, incomeTaxEstimate: 3_000_000 })
    const card = cards.find(c => c.id === 'young-startup-uncfgd')!
    expect(card.estimatedSavings).toBe(3_000_000)
  })

  it('사업비 카드 결제 비중 낮으면 business-card-priority trigger (데이터 기반)', () => {
    const txs = [
      tx('2026-06-01', '임대료' as Category, -1_000_000, '계좌이체'),  // 카드 외
      tx('2026-06-02', '소모품' as Category, -200_000, '카드'),
    ]
    const cards = getActionCards(txs, '2026-06-15', {})
    const card = cards.find(c => c.id === 'business-card-priority')!
    // businessExpenseTotal=1,200,000, card=200,000, ratio≈0.17 < 0.7 → trigger
    expect(card.triggered).toBe(true)
    // 일반과세 기본: 카드 외 1,000,000 × 10% 매입세액 잠재
    expect(card.estimatedSavings).toBe(100_000)
  })

  it('카드 결제 비중 높으면(100%) business-card-priority untriggered', () => {
    const txs = [tx('2026-06-01', '소모품' as Category, -1_000_000, '카드')]
    const cards = getActionCards(txs, '2026-06-15', {})
    const card = cards.find(c => c.id === 'business-card-priority')!
    expect(card.triggered).toBe(false)
  })

  it('비용 데이터 없으면 business-card-priority untriggered (제네릭 노출 X)', () => {
    const cards = getActionCards([], '2026-06-15', {})
    const card = cards.find(c => c.id === 'business-card-priority')!
    expect(card.triggered).toBe(false)
  })

  it('예비비 권장액 대비 적립 부족하면 reserve-shortfall trigger', () => {
    // 권장 월 50만 × 6월 경과 = 기대 300만, 적립 0 → 부족 300만 > 30만
    const cards = getActionCards([], '2026-06-15', { recommendedMonthlyReserve: 500_000 })
    const card = cards.find(c => c.id === 'reserve-shortfall')!
    expect(card.triggered).toBe(true)
  })

  it('예비비 충분히 적립했으면 reserve-shortfall untriggered', () => {
    // 기대 300만, 이미 reserve로 300만 적립 → 부족 0
    const txs = [tx('2026-04-01', '예비비' as Category, -3_000_000, '계좌이체', 'reserve')]
    const cards = getActionCards(txs, '2026-06-15', { recommendedMonthlyReserve: 500_000 })
    const card = cards.find(c => c.id === 'reserve-shortfall')!
    expect(card.triggered).toBe(false)
  })

  it('권장 예비비 정보 없으면 reserve-shortfall untriggered', () => {
    const cards = getActionCards([], '2026-06-15', {})
    const card = cards.find(c => c.id === 'reserve-shortfall')!
    expect(card.triggered).toBe(false)
  })

  it('최근 경조사비 결제 있으면 wedding-evidence trigger', () => {
    const cards = getActionCards(
      [tx('2026-02-15', '경조사비', -200_000, '계좌이체')],
      '2026-02-20',
      {},
    )
    const card = cards.find(c => c.id === 'wedding-evidence')!
    expect(card.triggered).toBe(true)
  })

  it('30일 이전 경조사비는 trigger 안 함', () => {
    const cards = getActionCards(
      [tx('2026-01-01', '경조사비', -200_000, '계좌이체')],
      '2026-03-15',
      {},
    )
    const card = cards.find(c => c.id === 'wedding-evidence')!
    expect(card.triggered).toBe(false)
  })

  it('노란우산 미가입(0)이면 한도 500만 남음, estimatedSavings 약 100만', () => {
    const cards = getActionCards([], '2026-03-01', { noranusanContribution: 0 })
    const card = cards.find(c => c.id === 'noranusan-room')!
    expect(card.triggered).toBe(true)
    expect(card.estimatedSavings).toBe(1_000_000)  // 500만 × 0.20
  })

  it('노란우산 한도 채웠으면 untriggered', () => {
    const cards = getActionCards([], '2026-03-01', { noranusanContribution: 5_000_000 })
    const card = cards.find(c => c.id === 'noranusan-room')!
    expect(card.triggered).toBe(false)
  })

  it('부가세 D-7 안: 4/19은 4/25까지 D-6', () => {
    const cards = getActionCards([], '2026-04-19', {})
    const card = cards.find(c => c.id === 'vat-prep')!
    expect(card.triggered).toBe(true)
  })

  it('부가세 D-30: vat-prep untriggered', () => {
    const cards = getActionCards([], '2026-03-26', {})
    const card = cards.find(c => c.id === 'vat-prep')!
    expect(card.triggered).toBe(false)
  })

  it('7개 카드 모두 결과에 포함 (trigger 여부와 무관)', () => {
    const cards = getActionCards([], '2026-07-01', {})
    expect(cards).toHaveLength(7)
    const ids = cards.map(c => c.id)
    expect(ids).toContain('young-startup-uncfgd')
    expect(ids).toContain('reserve-shortfall')
    expect(ids).toContain('business-card-priority')
    expect(ids).toContain('wedding-evidence')
    expect(ids).toContain('noranusan-room')
    expect(ids).toContain('vat-prep')
    expect(ids).toContain('utility-business-acct')
  })
})
