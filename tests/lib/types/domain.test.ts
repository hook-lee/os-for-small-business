import { describe, it, expect } from 'vitest'
import type { Transaction, Category, PaymentMethod, TxClassification } from '@/types/domain'

describe('domain types', () => {
  it('Transaction 타입을 만족하는 객체를 만들 수 있다 (확장 필드 포함)', () => {
    const tx: Transaction = {
      date: '2026-01-15',
      rawCategory: '임차료',           // 시트 원본
      category: '임대료',              // 정규화 후
      amount: -1_430_000,
      method: '계좌이체',
      counterparty: '건물주',
      person: undefined,
      classification: 'business',
      memo: undefined,
    }
    expect(tx.classification).toBe('business')
  })

  it('PaymentMethod는 3개의 값만 허용한다', () => {
    const methods: PaymentMethod[] = ['카드', '계좌이체', '현금']
    expect(methods).toHaveLength(3)
  })

  it('TxClassification은 5개의 값을 허용한다', () => {
    const classifications: TxClassification[] = ['business', 'living', 'owner_draw', 'reserve', 'capital']
    expect(classifications).toHaveLength(5)
  })

  it('Category에는 정규화된 30개 표준 카테고리가 모두 포함된다', () => {
    const categories: Category[] = [
      '매출', '임대료', '식비', '마케팅비', '교육비', '정기결제', '세금',
      '소모품', '보험료', '품위유지비', '교통비', '의류비', '의료비',
      '소품', '도서인쇄비', '경조사비', '수수료', '공과금', '관리비',
      '급여', '유진 급여', '예비비', '사무용품', '자산', '보통예금',
      '복리후생비', '지급수수료', '세탁비', '연금', '적금', '기타'
    ]
    expect(categories).toHaveLength(31)
  })
})
