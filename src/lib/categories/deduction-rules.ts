import type { Transaction } from '@/types/domain'
import { getTaxAttributes } from './mapping'

/**
 * 부가세 매입세액 공제 가능 여부 판정.
 *
 * v1 룰 (4가지 조건 모두 통과해야 공제):
 *   1. classification === 'business' (사업비여야 함; owner_draw/reserve/capital/living 제외)
 *   2. amount < 0 (지출만; 매출 행 제외)
 *   3. method !== '현금' (세금계산서 수취 의제 불가)
 *   4. getTaxAttributes(category).vatDeductibleByCategory === true (카테고리 룰)
 *
 * v2에서 추가될 룰: 상대방 사업자등록번호 진위확인, 면세업종 자동 판정.
 */
export function isVATDeductible(tx: Transaction): boolean {
  if (tx.classification !== 'business') return false
  if (tx.amount >= 0) return false
  if (tx.method === '현금') return false
  if (!getTaxAttributes(tx.category).vatDeductibleByCategory) return false
  return true
}
