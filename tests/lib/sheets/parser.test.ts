import { describe, it, expect } from 'vitest'
import { parseSheetRows } from '@/lib/sheets/parser'

describe('parseSheetRows', () => {
  it('Excel serial date 45344 → 2024-02-22', () => {
    const r = parseSheetRows([
      ['1', '2024-02', '45344', '자산', '-100000', '계좌이체', '-100000', '콤비리포머', ''],
    ])
    expect(r).toHaveLength(1)
    expect(r[0].date).toBe('2024-02-22')
  })

  it('"2024.02.22" 문자열 날짜 → "2024-02-22"', () => {
    const r = parseSheetRows([
      ['1', '2024-02', '2024.02.22', '자산', '-100000', '계좌이체', '-100000', '콤비리포머', ''],
    ])
    expect(r[0].date).toBe('2024-02-22')
  })

  it('카테고리 정규화: 임차료 → 임대료', () => {
    const r = parseSheetRows([
      ['1', '2024-03', '45371', '임차료', '-1430000', '계좌이체', '', '3월 임대료', ''],
    ])
    expect(r[0].rawCategory).toBe('임차료')
    expect(r[0].category).toBe('임대료')
    expect(r[0].classification).toBe('business')
  })

  it('owner_draw 분류: 유진 급여', () => {
    const r = parseSheetRows([
      ['1', '2024-09', '45901', '유진 급여', '-1218420', '계좌이체', '', '', ''],
    ])
    expect(r[0].classification).toBe('owner_draw')
  })

  it('헤더성 행 skip: "1월 종합"', () => {
    const r = parseSheetRows([
      ['1', '2024-02', '45323', '1월 종합', '-20000000', '', '', '', ''],
    ])
    expect(r).toHaveLength(0)
  })

  it('빈 행 skip', () => {
    const r = parseSheetRows([
      ['', '', '', '', '', '', '', '', ''],
    ])
    expect(r).toHaveLength(0)
  })

  it('수단 누락 행 skip', () => {
    const r = parseSheetRows([
      ['1', '2024-02', '45344', '식비', '-13500', '', '', '', ''],
    ])
    expect(r).toHaveLength(0)
  })

  it('잘못된 수단 ("카드결제") skip', () => {
    const r = parseSheetRows([
      ['1', '2024-02', '45344', '식비', '-13500', '카드결제', '', '', ''],
    ])
    expect(r).toHaveLength(0)
  })

  it('비고2의 사람 필드: 정상 이름은 보존', () => {
    const r = parseSheetRows([
      ['1', '2026-01', '45658', '매출', '650000', '카드', '650000', '개인레슨', '김기수'],
    ])
    expect(r[0].person).toBe('김기수')
  })

  it('비고2의 사람 필드: 순수 숫자("13898690")는 undefined 처리', () => {
    const r = parseSheetRows([
      ['1', '2024-02', '45351', '보통예금', '-5000000', '계좌이체', '-5000000', '권리금', '13898690'],
    ])
    expect(r[0].person).toBeUndefined()
  })

  it('비고2의 사람 필드: "%" 포함은 undefined 처리', () => {
    const r = parseSheetRows([
      ['1', '2024-02', '45344', '자산', '-100000', '계좌이체', '', '콤비리포머', '2.3% 수수료'],
    ])
    expect(r[0].person).toBeUndefined()
  })

  it('memo는 항상 undefined (시트엔 없음)', () => {
    const r = parseSheetRows([
      ['1', '2026-01', '45658', '매출', '650000', '카드', '650000', '', ''],
    ])
    expect(r[0].memo).toBeUndefined()
  })

  it('amount 부호 보존 (지출은 음수)', () => {
    const r = parseSheetRows([
      ['1', '2024-03', '45363', '임대료', '-2000000', '계좌이체', '', '', ''],
    ])
    expect(r[0].amount).toBe(-2_000_000)
  })

  it('알 수 없는 카테고리는 "기타"로 매핑', () => {
    const r = parseSheetRows([
      ['1', '2025-06', '45844', '알수없음', '-10000', '카드', '', '', ''],
    ])
    expect(r[0].category).toBe('기타')
    expect(r[0].rawCategory).toBe('알수없음')
  })
})
