import { describe, it, expect } from 'vitest'
import { simulateVAT, getQuarterRange } from '@/lib/tax/vat'
import type { Transaction, Category, PaymentMethod, TxClassification } from '@/types/domain'

function tx(
  date: string,
  category: Category,
  amount: number,
  method: PaymentMethod = '카드',
  classification: TxClassification = amount > 0 ? 'business' : 'business',
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

describe('getQuarterRange', () => {
  it('Q1 = 1/1 ~ 3/31', () => {
    const r = getQuarterRange(2026, 1)
    expect(r.start).toBe('2026-01-01')
    expect(r.end).toBe('2026-03-31')
  })

  it('Q2 = 4/1 ~ 6/30', () => {
    const r = getQuarterRange(2026, 2)
    expect(r.start).toBe('2026-04-01')
    expect(r.end).toBe('2026-06-30')
  })

  it('Q3 = 7/1 ~ 9/30', () => {
    const r = getQuarterRange(2026, 3)
    expect(r.start).toBe('2026-07-01')
    expect(r.end).toBe('2026-09-30')
  })

  it('Q4 = 10/1 ~ 12/31', () => {
    const r = getQuarterRange(2026, 4)
    expect(r.start).toBe('2026-10-01')
    expect(r.end).toBe('2026-12-31')
  })

  it('윤년 2/28 처리: 2024 Q1 = 1/1 ~ 3/31 (변동 없음)', () => {
    const r = getQuarterRange(2024, 1)
    expect(r.end).toBe('2024-03-31')
  })
})

describe('simulateVAT', () => {
  it('인적용역 케이스: 매출 1100만, 매입 0 → 부가세 100만', () => {
    const r = simulateVAT(
      [tx('2026-01-15', '매출', 11_000_000)],
      2026, 1,
    )
    expect(r.outputVAT).toBe(1_000_000)
    expect(r.inputVAT).toBe(0)
    expect(r.estimatedVAT).toBe(1_000_000)
    expect(r.year).toBe(2026)
    expect(r.quarter).toBe(1)
    expect(r.transactionCount).toBe(1)
  })

  it('임대료 매입 110만 → 매입세액 10만 차감, 예상 90만', () => {
    const r = simulateVAT(
      [
        tx('2026-01-15', '매출', 11_000_000),
        tx('2026-01-01', '임대료', -1_100_000, '계좌이체'),
      ],
      2026, 1,
    )
    expect(r.outputVAT).toBe(1_000_000)
    expect(r.inputVAT).toBe(100_000)
    expect(r.estimatedVAT).toBe(900_000)
  })

  it('분기 경계 거래는 제외 (4월 매출은 Q1에 포함 안 됨)', () => {
    const r = simulateVAT(
      [
        tx('2026-01-15', '매출', 11_000_000),
        tx('2026-04-15', '매출', 22_000_000),
      ],
      2026, 1,
    )
    expect(r.outputVAT).toBe(1_000_000)
    expect(r.transactionCount).toBe(1)
  })

  it('현금 매입은 공제 안 됨', () => {
    const r = simulateVAT(
      [
        tx('2026-01-15', '매출', 11_000_000),
        tx('2026-02-01', '임대료', -1_100_000, '현금'),
      ],
      2026, 1,
    )
    expect(r.inputVAT).toBe(0)
    expect(r.estimatedVAT).toBe(1_000_000)
  })

  it('경조사비는 사업비라도 매입세액 공제 불가', () => {
    const r = simulateVAT(
      [
        tx('2026-01-15', '매출', 11_000_000),
        tx('2026-02-05', '경조사비', -200_000, '계좌이체'),
      ],
      2026, 1,
    )
    expect(r.inputVAT).toBe(0)
  })

  it('유진 급여(owner_draw)는 매입세액 공제 불가', () => {
    const r = simulateVAT(
      [
        tx('2026-01-15', '매출', 11_000_000),
        { ...tx('2026-01-31', '유진 급여', -3_000_000, '계좌이체'), classification: 'owner_draw' },
      ],
      2026, 1,
    )
    expect(r.inputVAT).toBe(0)
  })

  it('빈 분기: 매출/지출 모두 0', () => {
    const r = simulateVAT([], 2026, 1)
    expect(r.outputVAT).toBe(0)
    expect(r.inputVAT).toBe(0)
    expect(r.estimatedVAT).toBe(0)
    expect(r.transactionCount).toBe(0)
  })

  it('여러 분기 데이터: Q2만 집계', () => {
    const r = simulateVAT(
      [
        tx('2026-01-15', '매출', 5_000_000),
        tx('2026-04-15', '매출', 11_000_000),
        tx('2026-05-01', '임대료', -1_100_000, '계좌이체'),
        tx('2026-07-15', '매출', 8_000_000),
      ],
      2026, 2,
    )
    expect(r.outputVAT).toBe(1_000_000)
    expect(r.inputVAT).toBe(100_000)
    expect(r.estimatedVAT).toBe(900_000)
  })
})
