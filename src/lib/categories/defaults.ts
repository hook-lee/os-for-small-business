/**
 * 기본 회계 계정과목 카테고리.
 *
 * - 시드 스크립트와 AddForm fallback 모두 이 데이터를 import.
 * - DB에 카테고리가 1개도 없으면 AddForm은 이걸 그대로 사용 (시드 안 돌려도 OK).
 * - description: 세무사가 봐도 어떤 비용인지 알 수 있게 + 끝에 **예시**: 형태로 구체적 사례 포함.
 */

import type { ExpenseCategory } from '@/lib/supabase/categories'

interface DefaultCategoryInput {
  name: string
  description: string
  classification: 'business' | 'living' | 'owner_draw' | 'reserve' | 'capital'
  vatDeductible: boolean
  incomeTaxDeductible: boolean
  displayOrder: number
}

export const DEFAULT_CATEGORIES_RAW: DefaultCategoryInput[] = [
  // ── 매출 (사업 수입)
  { name: '매출', description: '사업 수입 (수강료, 강의료, 체험 매출 등). **예시**: 회원 결제, 체험 수업, 출장 강의료.',
    classification: 'business', vatDeductible: false, incomeTaxDeductible: false, displayOrder: 1 },

  // ── 사업 경비 (income tax deductible)
  { name: '임차료', description: '사업장 월세·관리비. 세금계산서/현금영수증 받으면 부가세 공제. **예시**: 월세, 관리비, 보증금 감가상각.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 10 },
  { name: '광고선전비', description: '마케팅·홍보 비용. 부가세 공제 대상. **예시**: 인스타 광고비, 네이버 키워드, 전단지 인쇄, 오픈 이벤트 사은품.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 11 },
  { name: '회의비', description: '직원·내부 회의 식대·간식 (사업 관련, 한도 없음). 부가세 공제. **예시**: 직원 회식, 운영 회의 도시락, 내부 워크숍 식대.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 12 },
  { name: '접대비', description: '거래처 대상 식사·선물·경조사. 연 한도(매출×0.3%+1,200만). 부가세 공제 불가. **예시**: 거래처 식사, 명절 선물, 협력업체 경조사비.',
    classification: 'business', vatDeductible: false, incomeTaxDeductible: true, displayOrder: 13 },
  { name: '복리후생비', description: '직원 복지 비용. 부가세 공제. **예시**: 직원 식대, 간식, 야근 식대, 명절 선물, 건강검진 보조.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 14 },
  { name: '통신비', description: '사업용 휴대폰·인터넷·전화. 사업자 명의 시 부가세 환급. **예시**: 매장 인터넷, 사업용 휴대폰 요금, POS 통신비.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 15 },
  { name: '수도광열비', description: '사업장 전기·수도·가스. 사업자 명의 시 부가세 환급. **예시**: 전기요금, 수도요금, 도시가스, 난방비.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 16 },
  { name: '소모품비', description: '청소·사무·소모성 비품 (개당 10만원 미만). 부가세 공제. **예시**: 매트 청소용품, 수건, 일회용 컵, A4용지, 볼펜.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 17 },
  { name: '세금과공과', description: '사업소득세·부가세·지방세·4대보험 등. 본인 세금은 경비 불가. **예시**: 사업장 재산세, 자동차세, 직원 4대보험 사업주분.',
    classification: 'business', vatDeductible: false, incomeTaxDeductible: false, displayOrder: 18 },
  { name: '보험료', description: '사업 관련 보험 (화재·배상·자동차 등). 사업자 명의면 경비 인정. **예시**: 매장 화재보험, 영업배상책임보험, 사업용 차량 보험.',
    classification: 'business', vatDeductible: false, incomeTaxDeductible: true, displayOrder: 19 },
  { name: '지급수수료', description: '카드 가맹점 수수료·세무·은행 등. 부가세 공제. **예시**: 카드 수수료, 세무기장료, PG사 수수료, 은행 송금 수수료.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 20 },
  { name: '교육훈련비', description: '직원·본인 사업 관련 교육비. **예시**: 강사 자격증 수강, 필라테스 워크숍, 안전 교육, 세미나 등록비.',
    classification: 'business', vatDeductible: false, incomeTaxDeductible: true, displayOrder: 21 },
  { name: '차량유지비', description: '사업용 차량 유지비. 연 1,500만원 한도(운행기록부 미작성시). **예시**: 주유비, 자동차 수리, 주차요금, 통행료, 사업용 자동차세.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 22 },
  { name: '운반비', description: '택배·퀵·배송비. 부가세 공제. **예시**: 택배비, 퀵서비스, 화물 운송비.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 23 },
  { name: '도서인쇄비', description: '책·신문·인쇄물·명함. **예시**: 운영 관련 서적, 명함 제작, 안내문 인쇄, 회원 등록 카드 제작.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 24 },
  { name: '여비교통비', description: '사업 출장 시 교통·숙박. **예시**: KTX/항공권, 출장 숙박, 시내 택시(영수증), 워크숍 참가 교통비.',
    classification: 'business', vatDeductible: true, incomeTaxDeductible: true, displayOrder: 25 },
  { name: '경조사비', description: '거래처·직원 경조사. 청첩장/부고장 보관 시 건당 20만원까지 인정. **예시**: 직원 결혼 축의금, 거래처 부고 조의금, 출산 축하.',
    classification: 'business', vatDeductible: false, incomeTaxDeductible: true, displayOrder: 26 },

  // ── 자산성 (감가상각 대상)
  { name: '비품/감가상각', description: '100만원 이상 비품·장비 (감가상각 대상, 5년 분할 경비). **예시**: 리포머·캐딜락·체어 등 필라테스 기구, 음향 장비, 노트북, 에어컨.',
    classification: 'capital', vatDeductible: true, incomeTaxDeductible: false, displayOrder: 30 },

  // ── 운영자 인출 (owner_draw — 사업 경비 아님)
  { name: '대표자급여', description: '대표자 본인 인출. 종소세 경비 X — 사업소득의 일부. **예시**: 본인 생활비 인출, 본인 카드 사용분 정산.',
    classification: 'owner_draw', vatDeductible: false, incomeTaxDeductible: false, displayOrder: 40 },

  // ── 적립 (비용 아님)
  { name: '예비비', description: '세금 적립용. 비용이 아니라 단지 따로 빼두는 돈. **예시**: 부가세 적립, 종소세 적립, 노란우산공제 납입 대기.',
    classification: 'reserve', vatDeductible: false, incomeTaxDeductible: false, displayOrder: 41 },

  // ── 생활비 (사업 경비 X)
  { name: '식비(개인)', description: '대표자 본인 일상 식대 (사업 관련 회의비 아님). 경비 처리 불가. **예시**: 본인 점심, 가족 외식, 카페 개인 사용.',
    classification: 'living', vatDeductible: false, incomeTaxDeductible: false, displayOrder: 50 },
  { name: '생활비', description: '개인 생활비 일반. 경비 처리 불가. **예시**: 의류·미용·취미·여행·개인 의료비.',
    classification: 'living', vatDeductible: false, incomeTaxDeductible: false, displayOrder: 51 },
  { name: '기타', description: '분류 미정. 나중에 정확한 카테고리로 옮기기. **예시**: 카테고리가 애매한 일시적 지출.',
    classification: 'living', vatDeductible: false, incomeTaxDeductible: false, displayOrder: 99 },
]

/**
 * ExpenseCategory 호환 형태로 변환. id는 음수 (DB와 충돌 방지용 sentinel).
 */
export const DEFAULT_CATEGORIES: ExpenseCategory[] = DEFAULT_CATEGORIES_RAW.map((c, i) => ({
  id: -(i + 1),   // -1, -2, … (음수 → fallback 표시용임을 명확화)
  name: c.name,
  description: c.description,
  classification: c.classification,
  vatDeductible: c.vatDeductible,
  incomeTaxDeductible: c.incomeTaxDeductible,
  displayOrder: c.displayOrder,
  active: true,
  isDefault: true,
}))
