import type { Category, TxClassification } from '@/types/domain'

/**
 * 시트 원본 카테고리 → 정규화된 표준 카테고리 매핑.
 * 실데이터(2024-02 ~ 2026-01, 47 변형)에서 발견한 매핑들.
 */
const NORMALIZATION_MAP: Record<string, Category> = {
  '임차료': '임대료',
  '소모품비': '소모품',
  '마케팅': '마케팅비',
  '월급': '급여',
  '의류': '의류비',
  '교육': '교육비',
  '인쇄비': '도서인쇄비',
  '프린트': '도서인쇄비',
  '보혐료': '보험료',          // 오타 보정
  '경좃비': '경조사비',         // 오타 보정
  '경조선물비': '경조사비',
  '간식': '식비',
  '약': '의료비',
  '운송비': '수수료',
  '정기': '정기결제',
  '복지': '복리후생비',
}

/**
 * 표준 카테고리 30개 (Category union의 '기타' 제외 30개).
 * Set으로 만들어 빠른 lookup.
 */
const STANDARD_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  '매출', '임대료', '식비', '마케팅비', '교육비', '정기결제', '세금',
  '소모품', '보험료', '품위유지비', '교통비', '의류비', '의료비',
  '소품', '도서인쇄비', '경조사비', '수수료', '공과금', '관리비',
  '급여', '유진 급여', '예비비', '사무용품', '자산', '보통예금',
  '복리후생비', '지급수수료', '세탁비', '연금', '적금',
])

/**
 * 시트 셀의 카테고리 값을 정규화하여 표준 Category로 변환.
 * - 헤더성 행("N월 종합") → null
 * - 빈 값 → null
 * - 알려진 변형 → 매핑
 * - 표준 카테고리 → 그대로
 * - 알 수 없는 카테고리 → '기타' (loss-less fallback)
 */
export function normalizeCategory(raw: string | null | undefined): Category | null {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (trimmed === '') return null

  // 헤더성 행 ("1월 종합" ~ "12월 종합") 제외
  if (/^\d{1,2}월\s*종합$/.test(trimmed)) return null

  // 알려진 변형 매핑
  if (trimmed in NORMALIZATION_MAP) return NORMALIZATION_MAP[trimmed]

  // 표준 카테고리면 그대로
  if (STANDARD_CATEGORIES.has(trimmed as Category)) return trimmed as Category

  // 알 수 없는 카테고리는 '기타'로 fallback
  return '기타'
}

const OWNER_DRAW_CATEGORIES: ReadonlySet<Category> = new Set(['유진 급여'] as Category[])
const RESERVE_CATEGORIES: ReadonlySet<Category> = new Set(['예비비'] as Category[])
const CAPITAL_CATEGORIES: ReadonlySet<Category> = new Set([
  '자산', '보통예금', '사무용품',
] as Category[])
const BUSINESS_CATEGORIES: ReadonlySet<Category> = new Set([
  '매출', '임대료', '마케팅비', '정기결제', '세금', '보험료', '공과금',
  '관리비', '수수료', '교육비', '경조사비', '급여', '복리후생비', '지급수수료',
  '연금', '적금', '세탁비',
] as Category[])
// 나머지(식비·품위유지비·교통비·의류비·의료비·소품·도서인쇄비·소모품·기타) = 'living'

/**
 * Category → TxClassification 매핑.
 * 영업이익 계산·세금 시뮬레이션에서 분류별 처리에 사용.
 */
export function classify(category: Category): TxClassification {
  if (OWNER_DRAW_CATEGORIES.has(category)) return 'owner_draw'
  if (RESERVE_CATEGORIES.has(category)) return 'reserve'
  if (CAPITAL_CATEGORIES.has(category)) return 'capital'
  if (BUSINESS_CATEGORIES.has(category)) return 'business'
  return 'living'
}
