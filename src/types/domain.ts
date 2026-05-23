export type PaymentMethod = '카드' | '계좌이체' | '현금'

/**
 * 거래 분류 — 영업이익 계산 시 'business'만 사업비용으로 카운트.
 * - business: 사업비 (임대료·마케팅비·정기결제·세금·보험료·공과금·관리비 등)
 * - living: 생활비 (식비·품위유지비·교통비·의류비·의료비·소모품·소품 등)
 * - owner_draw: 운영자(유진) 본인 인출 (별도 KPI, 사업소득 차감 X)
 * - reserve: 세금 적립용 예비비 (별도 KPI, 비용 X)
 * - capital: 자산성 지출 (창업 자본·감가상각 대상, 별도 KPI)
 */
export type TxClassification = 'business' | 'living' | 'owner_draw' | 'reserve' | 'capital'

/**
 * 정규화된 표준 카테고리 (30개) + '기타' fallback.
 * 시트 원본의 47개 변형(오타·공백·동의어)은 정규화 레이어에서 이쪽으로 매핑.
 */
export type Category =
  | '매출' | '임대료' | '식비' | '마케팅비' | '교육비' | '정기결제' | '세금'
  | '소모품' | '보험료' | '품위유지비' | '교통비' | '의류비' | '의료비'
  | '소품' | '도서인쇄비' | '경조사비' | '수수료' | '공과금' | '관리비'
  | '급여' | '유진 급여' | '예비비' | '사무용품' | '자산' | '보통예금'
  | '복리후생비' | '지급수수료' | '세탁비' | '연금' | '적금' | '기타'

export interface Transaction {
  id?: number                         // Supabase row PK (fixture 출처면 undefined — 삭제 불가)
  date: string                        // ISO yyyy-mm-dd
  rawCategory: string                 // 시트 원본 (오타·공백 포함)
  category: Category                  // 정규화된 표준 카테고리
  amount: number                      // 부호로 매출(+)/지출(-)
  method: PaymentMethod
  counterparty: string | undefined    // 비고1 (가맹점/거래처)
  person: string | undefined          // 비고2 (사람)
  classification: TxClassification
  memo: string | undefined
}

export interface TaxAttributes {
  isBusinessExpense: boolean
  vatDeductibleByCategory: boolean
  incomeTaxDeductible: boolean
}

export interface VATResult {
  year: number
  quarter: 1 | 2 | 3 | 4
  outputVAT: number       // 매출세액
  inputVAT: number        // 매입세액
  estimatedVAT: number    // 예상 납부액
  transactionCount: number
}

export interface IncomeTaxResult {
  year: number
  annualizedRevenue: number
  annualizedExpense: number
  businessIncome: number    // 사업소득금액
  taxableBase: number       // 과세표준
  computedTax: number       // 산출세액 (감면 전)
  estimatedTax: number      // 예상 납부액 (세액공제 + 청년창업감면 반영)
  asOfDate: string
}

export interface ReserveRecommendation {
  monthly: number
  annualTaxEstimate: number
  breakdown: {
    vatTotal: number
    incomeTaxTotal: number
  }
}

export interface DueDate {
  type: 'VAT' | 'INCOME_TAX'
  label: string
  date: string              // yyyy-mm-dd
  daysRemaining: number
}

export interface ActionCard {
  id: string
  title: string
  description: string
  estimatedSavings: number | undefined
  category: 'deduction' | 'evidence' | 'preparation' | 'general'
  triggered: boolean
}
