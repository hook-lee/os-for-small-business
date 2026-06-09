/**
 * CSV 가져오기(마이그레이션) 엔티티 스키마 — 클라이언트(템플릿·매핑 UI·안내)와
 * 서버(검증 매핑)가 공유하는 단일 정의.
 *
 * aliases: 다른 SaaS/엑셀에서 흔히 쓰는 헤더 변형. 자동 매핑 추측(guessMapping)에 사용.
 */
export type ImportEntity = 'members' | 'instructors' | 'lessons' | 'transactions'

export interface ImportColumn {
  header: string      // 우리 표준 컬럼명(한국어)
  required: boolean
  example: string
  hint?: string
  aliases?: string[]  // 흔한 헤더 변형(한/영) — 자동 매핑 추측용
}

export interface ImportSchema {
  entity: ImportEntity
  label: string
  columns: ImportColumn[]
  note?: string
}

export const IMPORT_ENTITIES: ImportEntity[] = ['members', 'instructors', 'lessons', 'transactions']

// 여러 엔티티에서 공통으로 쓰는 별칭
const PHONE_ALIASES = ['전화', '연락처', '휴대폰', '핸드폰', '휴대전화', '핸드폰번호', '전화번호1', 'hp', 'phone', 'mobile', 'tel', 'cell', '연락처1']
const NAME_ALIASES = ['성명', '성함', '이름', 'name', '고객명']
const DATE_ALIASES = ['일자', '날짜', 'date']
const MEMO_ALIASES = ['비고', '특이사항', '내용', '설명', '참고', 'note', 'memo', 'remark', 'comment']

export const IMPORT_SCHEMAS: Record<ImportEntity, ImportSchema> = {
  members: {
    entity: 'members',
    label: '회원',
    columns: [
      { header: '이름', required: true, example: '홍길동', aliases: [...NAME_ALIASES, '회원명', '회원이름', '수강생', '고객'] },
      { header: '전화번호', required: false, example: '010-1234-5678', aliases: PHONE_ALIASES },
      { header: '이메일', required: false, example: 'hong@example.com', aliases: ['메일', 'email', 'e-mail', 'mail'] },
      { header: '성별', required: false, example: '여', aliases: ['gender', 'sex'] },
      { header: '생년월일', required: false, example: '1990-01-15', hint: 'YYYY-MM-DD', aliases: ['생일', '출생일', '생년', 'birth', 'birthday', 'birthdate', 'dob'] },
      { header: '주소', required: false, example: '서울 강남구', aliases: ['주소지', 'address', 'addr'] },
      { header: '등급', required: false, example: 'VIP', aliases: ['회원등급', '멤버십', '회원유형', 'tier', 'grade', 'level', 'membership'] },
      { header: '메모', required: false, example: '', aliases: MEMO_ALIASES },
    ],
  },
  instructors: {
    entity: 'instructors',
    label: '강사',
    columns: [
      { header: '이름', required: true, example: '김강사', aliases: [...NAME_ALIASES, '강사명', '강사이름', '선생님', '직원명', '담당자'] },
      { header: '전화번호', required: false, example: '010-2222-3333', aliases: PHONE_ALIASES },
      { header: '역할', required: false, example: 'instructor', hint: 'owner/admin/instructor · 비우면 instructor', aliases: ['직급', '권한', '구분', 'role', 'position'] },
      { header: '기본시급', required: false, example: '30000', aliases: ['시급', '기본급', '기본 시급', 'hourly', 'rate', 'hourlyrate'] },
      { header: '개인시급', required: false, example: '35000', aliases: ['개인', '개인레슨시급', 'private'] },
      { header: '재활시급', required: false, example: '40000', aliases: ['재활', 'rehab'] },
      { header: '듀엣시급', required: false, example: '25000', aliases: ['듀엣', 'duet'] },
      { header: '그룹시급', required: false, example: '20000', aliases: ['그룹', 'group'] },
    ],
  },
  lessons: {
    entity: 'lessons',
    label: '수업(일정)',
    columns: [
      { header: '회원이름', required: true, example: '홍길동', aliases: [...NAME_ALIASES, '회원명', '회원', '수강생', '고객명', 'member'] },
      { header: '날짜', required: true, example: '2026-03-15', hint: 'YYYY-MM-DD', aliases: [...DATE_ALIASES, '수업일', '예약일', '수업날짜', '수업일자'] },
      { header: '시간', required: false, example: '14:00', aliases: ['수업시간', '예약시간', '시작시간', 'time', 'starttime'] },
      { header: '강사이름', required: false, example: '김강사', aliases: ['강사명', '강사', '담당강사', '선생님', '트레이너', 'instructor', 'teacher', 'trainer'] },
      { header: '시간(분)', required: false, example: '50', aliases: ['소요시간', '진행시간', 'duration', '분', 'minutes'] },
      { header: '메모', required: false, example: '', aliases: MEMO_ALIASES },
    ],
    note: '회원·강사를 먼저 가져온 뒤 import 하세요. 이름으로 매칭합니다(못 찾으면 그 줄만 건너뜀).',
  },
  transactions: {
    entity: 'transactions',
    label: '매출/지출',
    columns: [
      { header: '날짜', required: true, example: '2026-03-15', hint: 'YYYY-MM-DD', aliases: [...DATE_ALIASES, '거래일', '결제일', '거래일자', '결제일자'] },
      { header: '카테고리', required: true, example: '매출', hint: "매출은 '매출', 비용은 임대료·마케팅비 등", aliases: ['분류', '항목', '계정', '계정과목', '구분', '내역', 'category', 'type'] },
      { header: '금액', required: true, example: '500000', hint: '양수로 입력 (매출/지출은 카테고리로 구분)', aliases: ['가격', '액수', '결제금액', '총액', '합계', 'amount', 'price', 'total'] },
      { header: '결제수단', required: false, example: '카드', hint: '카드/계좌이체/현금', aliases: ['결제방법', '수단', '지불방법', '지불수단', 'method', 'payment', 'paymentmethod'] },
      { header: '거래처', required: false, example: '', aliases: ['상호', '공급처', '가맹점', '거래상대', '거래대상', 'vendor', 'counterparty'] },
      { header: '메모', required: false, example: '', aliases: MEMO_ALIASES },
    ],
    note: "'매출' 카테고리는 매출로, 나머지는 지출로 집계됩니다.",
  },
}

/** 템플릿 CSV 문자열 생성 (헤더 + 예시 1행). 클라이언트 다운로드용. */
export function buildTemplateCSV(entity: ImportEntity): string {
  const schema = IMPORT_SCHEMAS[entity]
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const headerLine = schema.columns.map(c => esc(c.header)).join(',')
  const exampleLine = schema.columns.map(c => esc(c.example)).join(',')
  return `${headerLine}\n${exampleLine}\n`
}
