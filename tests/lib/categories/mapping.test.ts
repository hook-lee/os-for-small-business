import { describe, it, expect } from 'vitest'
import { getTaxAttributes, isBusinessCategory } from '@/lib/categories/mapping'

describe('카테고리 → TaxAttributes 매핑', () => {
  it('임대료는 사업비 + 부가세 공제 가능 + 종소세 필요경비', () => {
    const a = getTaxAttributes('임대료')
    expect(a.isBusinessExpense).toBe(true)
    expect(a.vatDeductibleByCategory).toBe(true)
    expect(a.incomeTaxDeductible).toBe(true)
  })

  it('경조사비는 사업비 + 부가세 공제 불가 + 종소세 필요경비 인정', () => {
    const a = getTaxAttributes('경조사비')
    expect(a.isBusinessExpense).toBe(true)
    expect(a.vatDeductibleByCategory).toBe(false)
    expect(a.incomeTaxDeductible).toBe(true)
  })

  it('식비는 생활비 (영업이익 라인 아래)', () => {
    const a = getTaxAttributes('식비')
    expect(a.isBusinessExpense).toBe(false)
    expect(a.vatDeductibleByCategory).toBe(false)
    expect(a.incomeTaxDeductible).toBe(false)
  })

  it('매출은 영업 항목 (isBusinessExpense=true의 의미는 "비용으로 인정"이 아니라 "사업 라인")', () => {
    expect(isBusinessCategory('매출')).toBe(true)
  })

  it('세금 카테고리: 사업 항목이지만 부가세 자체이므로 매입세액 공제 불가', () => {
    const a = getTaxAttributes('세금')
    expect(a.isBusinessExpense).toBe(true)
    expect(a.vatDeductibleByCategory).toBe(false)
  })

  it('보험료: 사업 항목이지만 일반적으로 면세, 매입세액 공제 X', () => {
    const a = getTaxAttributes('보험료')
    expect(a.isBusinessExpense).toBe(true)
    expect(a.vatDeductibleByCategory).toBe(false)
    expect(a.incomeTaxDeductible).toBe(true)
  })

  it('유진 급여(owner draw): isBusinessExpense=false (사업비 아님, 사업소득의 일부)', () => {
    const a = getTaxAttributes('유진 급여')
    expect(a.isBusinessExpense).toBe(false)
    expect(a.incomeTaxDeductible).toBe(false)
  })

  it('예비비(reserve): 모두 false (세금 적립용, 실제 비용 아님)', () => {
    const a = getTaxAttributes('예비비')
    expect(a.isBusinessExpense).toBe(false)
    expect(a.vatDeductibleByCategory).toBe(false)
    expect(a.incomeTaxDeductible).toBe(false)
  })

  it('자산/보통예금(capital): 사업비 아님 (감가상각 대상), 부가세는 자산 취득 시 공제 가능하지만 v1에서는 false 처리', () => {
    const asset = getTaxAttributes('자산')
    expect(asset.isBusinessExpense).toBe(false)
    expect(asset.vatDeductibleByCategory).toBe(false)
  })

  it('급여(직원): 사업비, VAT 면세, 종소세 필요경비', () => {
    const a = getTaxAttributes('급여')
    expect(a.isBusinessExpense).toBe(true)
    expect(a.vatDeductibleByCategory).toBe(false)
    expect(a.incomeTaxDeductible).toBe(true)
  })

  it('isBusinessCategory는 getTaxAttributes().isBusinessExpense의 shortcut', () => {
    expect(isBusinessCategory('임대료')).toBe(true)
    expect(isBusinessCategory('식비')).toBe(false)
    expect(isBusinessCategory('예비비')).toBe(false)
  })

  it('모든 31개 표준 카테고리에 매핑이 존재 (undefined 발생 안 함)', () => {
    const allCategories = [
      '매출', '임대료', '식비', '마케팅비', '교육비', '정기결제', '세금',
      '소모품', '보험료', '품위유지비', '교통비', '의류비', '의료비',
      '소품', '도서인쇄비', '경조사비', '수수료', '공과금', '관리비',
      '급여', '유진 급여', '예비비', '사무용품', '자산', '보통예금',
      '복리후생비', '지급수수료', '세탁비', '연금', '적금', '기타',
    ] as const
    for (const c of allCategories) {
      const a = getTaxAttributes(c)
      expect(typeof a.isBusinessExpense).toBe('boolean')
      expect(typeof a.vatDeductibleByCategory).toBe('boolean')
      expect(typeof a.incomeTaxDeductible).toBe('boolean')
    }
  })
})
