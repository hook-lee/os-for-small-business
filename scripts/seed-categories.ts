// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-categories.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, key, { auth: { persistSession: false } })

const CATEGORIES = [
  // 사업비 (income tax deductible)
  { name: '매출',         description: '사업 수입 (수강료, 강의료 등)', classification: 'business', vat_deductible: false, income_tax_deductible: false, display_order: 1 },
  { name: '임차료',       description: '사업장 월세, 보증금 상각. 세금계산서 받으면 부가세 공제.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 10 },
  { name: '광고선전비',   description: '마케팅·홍보 (SNS 광고, 인쇄물, 이벤트 등). 부가세 공제 대상.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 11 },
  { name: '회의비',       description: '직원·내부 회의 식대·간식 (한도 없음, 사업 관련). 부가세 공제.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 12 },
  { name: '접대비',       description: '거래처 대상 식사·선물·경조사. 연 한도 (매출 ×0.3% + 1,200만). 부가세 공제 불가.', classification: 'business', vat_deductible: false, income_tax_deductible: true, display_order: 13 },
  { name: '복리후생비',   description: '직원 복지 (식대, 간식, 야근 식대). 부가세 공제.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 14 },
  { name: '통신비',       description: '사업용 휴대폰·인터넷·전화. 사업자등록 시 부가세 환급.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 15 },
  { name: '수도광열비',   description: '사업장 전기·수도·가스. 사업자 명의 시 부가세 환급.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 16 },
  { name: '소모품비',     description: '청소용품·사무용품·소모성 비품 (10만원 미만). 부가세 공제.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 17 },
  { name: '세금과공과',   description: '사업소득세·부가세·지방세·4대보험. 본인 세금은 경비 불가.', classification: 'business', vat_deductible: false, income_tax_deductible: false, display_order: 18 },
  { name: '보험료',       description: '사업 관련 보험 (화재·배상·자동차). 사업자명의면 종소세 경비.', classification: 'business', vat_deductible: false, income_tax_deductible: true, display_order: 19 },
  { name: '지급수수료',   description: '카드 가맹점 수수료·세무기장료·법무비·은행 수수료.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 20 },
  { name: '교육훈련비',   description: '직원·본인 교육 (강의 수강, 세미나 등록). 사업 관련 시.', classification: 'business', vat_deductible: false, income_tax_deductible: true, display_order: 21 },
  { name: '차량유지비',   description: '사업용 차량 유류·수리·주차·보험·자동차세. 연 1,500만원 한도(운행기록부 미작성).', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 22 },
  { name: '운반비',       description: '택배·퀵·배송비. 부가세 공제.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 23 },
  { name: '도서인쇄비',   description: '책·신문·정기간행물·인쇄물·명함 제작.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 24 },
  { name: '여비교통비',   description: '사업 출장 (대중교통·KTX·항공·숙박). 부가세 공제 일부.', classification: 'business', vat_deductible: true, income_tax_deductible: true, display_order: 25 },
  { name: '경조사비',     description: '거래처·직원 경조사. 청첩장·부고장 보관 시 건당 20만원까지 인정.', classification: 'business', vat_deductible: false, income_tax_deductible: true, display_order: 26 },
  // 자산성 (capital)
  { name: '비품/감가상각', description: '100만원 이상 비품·장비 (감가상각 대상). 5년 분할 경비.', classification: 'capital', vat_deductible: true, income_tax_deductible: false, display_order: 30 },
  // 운영자 인출
  { name: '대표자급여',   description: '대표자 본인 인출 (owner draw). 종소세에서 경비 X — 사업소득의 일부.', classification: 'owner_draw', vat_deductible: false, income_tax_deductible: false, display_order: 40 },
  { name: '예비비',       description: '세금 적립용. 비용 아님 — 단지 따로 빼두는 돈.', classification: 'reserve', vat_deductible: false, income_tax_deductible: false, display_order: 41 },
  // 생활비 (사업 경비 X)
  { name: '식비(개인)',   description: '대표자 본인 일상 식대 (사업 관련 회의비 아님). 경비 처리 불가.', classification: 'living', vat_deductible: false, income_tax_deductible: false, display_order: 50 },
  { name: '생활비',       description: '개인 생활비 일반 (의류·미용·취미). 경비 처리 불가.', classification: 'living', vat_deductible: false, income_tax_deductible: false, display_order: 51 },
  { name: '기타',         description: '분류 미정 (나중에 정확한 카테고리로 옮기기).', classification: 'living', vat_deductible: false, income_tax_deductible: false, display_order: 99 },
]

async function main() {
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    process.exit(1)
  }
  console.log(`Seeding ${CATEGORIES.length} categories...`)
  const { data: existing } = await supabase.from('expense_categories').select('name')
  const existingNames = new Set((existing ?? []).map((c: { name: string }) => c.name))

  const toInsert = CATEGORIES.filter(c => !existingNames.has(c.name)).map(c => ({ ...c, is_default: true }))
  if (toInsert.length === 0) {
    console.log('All categories already exist.')
    return
  }
  console.log(`Inserting ${toInsert.length} new categories...`)
  const { error } = await supabase.from('expense_categories').insert(toInsert)
  if (error) { console.error('Insert failed:', error.message); process.exit(1) }
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
