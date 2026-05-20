import type { Category, TaxAttributes } from '@/types/domain'

/**
 * 31개 표준 카테고리(30 + 기타) → 세무 속성 매핑.
 * 라파 필라테스(인적용역) 케이스에 맞춰진 보수적 룰.
 *
 * - isBusinessExpense: 영업이익 계산 시 사업비용/매출 라인. owner_draw/reserve/capital/생활비는 false.
 * - vatDeductibleByCategory: 부가세 매입세액 공제 가능 카테고리. 면세업종(보험·교육·의료)·접대성·세금 자체는 false.
 * - incomeTaxDeductible: 종소세 필요경비 인정 여부.
 */
const CATEGORY_MAP: Record<Category, TaxAttributes> = {
  '매출':       { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '임대료':     { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  '식비':       { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '마케팅비':   { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  '교육비':     { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: true },
  '정기결제':   { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  '세금':       { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '소모품':     { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '보험료':     { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: true },
  '품위유지비': { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '교통비':     { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '의류비':     { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '의료비':     { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '소품':       { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '도서인쇄비': { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '경조사비':   { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: true },
  '수수료':     { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  '공과금':     { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  '관리비':     { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  '급여':       { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: true },
  '유진 급여':  { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },  // owner draw
  '예비비':     { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },  // 적립용
  '사무용품':   { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },  // capital
  '자산':       { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },  // capital
  '보통예금':   { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },  // capital
  '복리후생비': { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: true },
  '지급수수료': { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  '세탁비':     { isBusinessExpense: true,  vatDeductibleByCategory: true,  incomeTaxDeductible: true },
  '연금':       { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: true },
  '적금':       { isBusinessExpense: true,  vatDeductibleByCategory: false, incomeTaxDeductible: false },
  '기타':       { isBusinessExpense: false, vatDeductibleByCategory: false, incomeTaxDeductible: false },
}

export function getTaxAttributes(category: Category): TaxAttributes {
  return CATEGORY_MAP[category]
}

export function isBusinessCategory(category: Category): boolean {
  return CATEGORY_MAP[category].isBusinessExpense
}
