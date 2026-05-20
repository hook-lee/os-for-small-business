import { describe, it, expect } from 'vitest'
import { normalizeCategory, classify } from '@/lib/categories/normalize'

describe('normalizeCategory', () => {
  it('동의어 정규화: 임차료 → 임대료', () => {
    expect(normalizeCategory('임차료')).toBe('임대료')
  })

  it('동의어 정규화: 소모품비 → 소모품, 마케팅 → 마케팅비', () => {
    expect(normalizeCategory('소모품비')).toBe('소모품')
    expect(normalizeCategory('마케팅')).toBe('마케팅비')
  })

  it('오타 정규화: 보혐료 → 보험료, 경좃비 → 경조사비', () => {
    expect(normalizeCategory('보혐료')).toBe('보험료')
    expect(normalizeCategory('경좃비')).toBe('경조사비')
  })

  it('앞 공백 정규화: " 유진 급여" → "유진 급여"', () => {
    expect(normalizeCategory(' 유진 급여')).toBe('유진 급여')
  })

  it('의미 매핑: 약 → 의료비, 간식 → 식비, 정기 → 정기결제', () => {
    expect(normalizeCategory('약')).toBe('의료비')
    expect(normalizeCategory('간식')).toBe('식비')
    expect(normalizeCategory('정기')).toBe('정기결제')
  })

  it('표준 카테고리는 그대로 반환', () => {
    expect(normalizeCategory('식비')).toBe('식비')
    expect(normalizeCategory('매출')).toBe('매출')
  })

  it('헤더성 행("1월 종합", "2월 종합") → null', () => {
    expect(normalizeCategory('1월 종합')).toBeNull()
    expect(normalizeCategory('12월 종합')).toBeNull()
  })

  it('빈 값 / null / undefined → null', () => {
    expect(normalizeCategory('')).toBeNull()
    expect(normalizeCategory(null)).toBeNull()
    expect(normalizeCategory(undefined)).toBeNull()
  })

  it('알 수 없는 카테고리 → "기타"', () => {
    expect(normalizeCategory('알수없는카테고리')).toBe('기타')
  })
})

describe('classify', () => {
  it('유진 급여 → owner_draw', () => {
    expect(classify('유진 급여')).toBe('owner_draw')
  })

  it('예비비 → reserve', () => {
    expect(classify('예비비')).toBe('reserve')
  })

  it('자산, 보통예금, 사무용품 → capital', () => {
    expect(classify('자산')).toBe('capital')
    expect(classify('보통예금')).toBe('capital')
    expect(classify('사무용품')).toBe('capital')
  })

  it('임대료, 마케팅비, 정기결제 → business', () => {
    expect(classify('임대료')).toBe('business')
    expect(classify('마케팅비')).toBe('business')
    expect(classify('정기결제')).toBe('business')
  })

  it('식비, 품위유지비, 교통비 → living', () => {
    expect(classify('식비')).toBe('living')
    expect(classify('품위유지비')).toBe('living')
    expect(classify('교통비')).toBe('living')
  })

  it('경조사비는 business (종소세 필요경비 인정)', () => {
    expect(classify('경조사비')).toBe('business')
  })

  it('급여(직원), 복리후생비도 business', () => {
    expect(classify('급여')).toBe('business')
    expect(classify('복리후생비')).toBe('business')
  })
})
