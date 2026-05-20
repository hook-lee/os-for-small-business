import { describe, it, expect } from 'vitest'
import { getActionCards } from '@/lib/advice/action-cards'
import type { Transaction, Category, PaymentMethod } from '@/types/domain'

function tx(date: string, category: Category, amount: number, method: PaymentMethod = '카드'): Transaction {
  return {
    date,
    rawCategory: category,
    category,
    amount,
    method,
    counterparty: undefined,
    person: undefined,
    classification: 'business',
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

  it('business-card-priority는 항상 triggered', () => {
    const cards = getActionCards([], '2026-06-15', {})
    const card = cards.find(c => c.id === 'business-card-priority')!
    expect(card.triggered).toBe(true)
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

  it('6개 카드 모두 결과에 포함 (trigger 여부와 무관)', () => {
    const cards = getActionCards([], '2026-07-01', {})
    expect(cards).toHaveLength(6)
    const ids = cards.map(c => c.id)
    expect(ids).toContain('young-startup-uncfgd')
    expect(ids).toContain('business-card-priority')
    expect(ids).toContain('utility-business-acct')
    expect(ids).toContain('wedding-evidence')
    expect(ids).toContain('noranusan-room')
    expect(ids).toContain('vat-prep')
  })
})
