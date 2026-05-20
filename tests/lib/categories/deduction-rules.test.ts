import { describe, it, expect } from 'vitest'
import { isVATDeductible } from '@/lib/categories/deduction-rules'
import type { Transaction, Category, PaymentMethod, TxClassification } from '@/types/domain'

const tx = (overrides: Partial<Transaction>): Transaction => ({
  date: '2026-02-01',
  rawCategory: '임대료',
  category: '임대료',
  amount: -1_430_000,
  method: '계좌이체',
  counterparty: '건물주',
  person: undefined,
  classification: 'business',
  memo: undefined,
  ...overrides,
})

describe('isVATDeductible', () => {
  it('임대료 + 계좌이체 + business + 음수금액 → 공제 가능', () => {
    expect(isVATDeductible(tx({}))).toBe(true)
  })

  it('현금 결제 → 공제 불가', () => {
    expect(isVATDeductible(tx({ method: '현금' }))).toBe(false)
  })

  it('classification이 living이면 공제 불가 (식비)', () => {
    expect(isVATDeductible(tx({ category: '식비', classification: 'living', amount: -10_000, method: '카드' }))).toBe(false)
  })

  it('classification이 owner_draw면 공제 불가 (유진 급여)', () => {
    expect(isVATDeductible(tx({ category: '유진 급여', classification: 'owner_draw', amount: -3_000_000, method: '계좌이체' }))).toBe(false)
  })

  it('classification이 reserve면 공제 불가 (예비비)', () => {
    expect(isVATDeductible(tx({ category: '예비비', classification: 'reserve', amount: -1_800_000, method: '계좌이체' }))).toBe(false)
  })

  it('classification이 capital이면 공제 불가 (자산)', () => {
    expect(isVATDeductible(tx({ category: '자산', classification: 'capital', amount: -100_000, method: '계좌이체' }))).toBe(false)
  })

  it('경조사비는 business지만 vatDeductibleByCategory=false라 공제 불가', () => {
    expect(isVATDeductible(tx({ category: '경조사비', amount: -200_000, method: '계좌이체' }))).toBe(false)
  })

  it('세금 카테고리는 공제 불가 (vatDeductibleByCategory=false)', () => {
    expect(isVATDeductible(tx({ category: '세금', amount: -38_610, method: '계좌이체' }))).toBe(false)
  })

  it('보험료(면세업종)는 공제 불가', () => {
    expect(isVATDeductible(tx({ category: '보험료', amount: -767_420, method: '계좌이체' }))).toBe(false)
  })

  it('매출 행은 공제 대상 아님 (amount >= 0)', () => {
    expect(isVATDeductible(tx({ category: '매출', classification: 'business', amount: 650_000, method: '카드' }))).toBe(false)
  })

  it('마케팅비 + 카드 → 공제 가능', () => {
    expect(isVATDeductible(tx({ category: '마케팅비', amount: -50_000, method: '카드' }))).toBe(true)
  })

  it('수수료 + 계좌이체 → 공제 가능', () => {
    expect(isVATDeductible(tx({ category: '수수료', amount: -3_000, method: '계좌이체' }))).toBe(true)
  })

  it('공과금 + 카드 → 공제 가능 (단, 사업자번호 등록 시. v1에서는 단순화)', () => {
    expect(isVATDeductible(tx({ category: '공과금', amount: -76_293, method: '카드' }))).toBe(true)
  })
})
