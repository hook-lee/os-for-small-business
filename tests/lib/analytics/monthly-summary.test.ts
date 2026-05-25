import { describe, it, expect } from 'vitest'
import { computeMonthlySummary, computeAllMonthsSummary } from '@/lib/analytics/monthly-summary'
import type { Transaction } from '@/types/domain'

function tx(date: string, category: string, amount: number, method: '카드' | '계좌이체' | '현금' = '카드'): Transaction {
  return {
    date,
    rawCategory: category,
    category: category as Transaction['category'],
    amount,
    method,
    counterparty: undefined,
    person: undefined,
    classification: amount > 0 ? 'business' : 'living',
    memo: undefined,
  } as Transaction
}

describe('computeMonthlySummary', () => {
  it('매출과 결제수단별 분리', () => {
    const txs = [
      tx('2026-05-01', '매출', 100000, '카드'),
      tx('2026-05-02', '매출', 50000, '현금'),
      tx('2026-05-03', '매출', 200000, '계좌이체'),
      tx('2026-04-01', '매출', 999999, '카드'),   // 다른 월
    ]
    const s = computeMonthlySummary(txs, '2026-05')
    expect(s.revenue).toBe(350000)
    expect(s.revenueByMethod.card).toBe(100000)
    expect(s.revenueByMethod.cash).toBe(50000)
    expect(s.revenueByMethod.transfer).toBe(200000)
    expect(s.revenueCountByMethod.card).toBe(1)
    expect(s.revenueCountByMethod.cash).toBe(1)
    expect(s.revenueCountByMethod.transfer).toBe(1)
    expect(s.transactionCount).toBe(3)
  })

  it('사업 비용 vs 개인 비용 분리', () => {
    const txs = [
      tx('2026-05-01', '임대료', -1430000),       // business
      tx('2026-05-02', '공과금', -113000),        // business
      tx('2026-05-03', '식비', -25000),           // personal
      tx('2026-05-04', '의류비', -50000),         // personal
      tx('2026-05-05', '교통비', -3000),          // personal
    ]
    const s = computeMonthlySummary(txs, '2026-05')
    expect(s.businessCosts['임대료']).toBe(1430000)
    expect(s.businessCosts['공과금']).toBe(113000)
    expect(s.businessCostTotal).toBe(1543000)
    expect(s.personalCosts['식비']).toBe(25000)
    expect(s.personalCosts['의류비']).toBe(50000)
    expect(s.personalCosts['교통비']).toBe(3000)
    expect(s.personalCostTotal).toBe(78000)
  })

  it('영업이익 + 순수익 계산', () => {
    const txs = [
      tx('2026-05-01', '매출', 1000000),
      tx('2026-05-02', '임대료', -200000),       // 사업
      tx('2026-05-03', '식비', -50000),          // 개인
    ]
    const s = computeMonthlySummary(txs, '2026-05')
    expect(s.revenue).toBe(1000000)
    expect(s.businessCostTotal).toBe(200000)
    expect(s.operatingProfit).toBe(800000)
    expect(s.personalCostTotal).toBe(50000)
    expect(s.netProfit).toBe(750000)
  })

  it('기타 비용 + 자본성 제외', () => {
    const txs = [
      tx('2026-05-01', '자산', -100000),         // 제외 (capital)
      tx('2026-05-02', '대표자급여', -500000),   // 제외 (owner draw)
      tx('2026-05-03', '알수없는카테고리', -30000), // 기타
    ]
    const s = computeMonthlySummary(txs, '2026-05')
    expect(s.businessCostTotal).toBe(0)
    expect(s.personalCostTotal).toBe(0)
    expect(s.otherCosts).toBe(30000)
  })

  it('빈 월', () => {
    const s = computeMonthlySummary([], '2026-05')
    expect(s.revenue).toBe(0)
    expect(s.operatingProfit).toBe(0)
    expect(s.netProfit).toBe(0)
    expect(s.transactionCount).toBe(0)
  })
})

describe('computeAllMonthsSummary', () => {
  it('등장한 모든 월 정렬', () => {
    const txs = [
      tx('2026-05-01', '매출', 100000),
      tx('2026-03-15', '매출', 50000),
      tx('2026-04-20', '임대료', -200000),
    ]
    const summaries = computeAllMonthsSummary(txs)
    expect(summaries.map(s => s.yearMonth)).toEqual(['2026-03', '2026-04', '2026-05'])
    expect(summaries[0].revenue).toBe(50000)
    expect(summaries[1].businessCostTotal).toBe(200000)
    expect(summaries[2].revenue).toBe(100000)
  })
})
