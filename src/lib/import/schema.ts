/**
 * CSV 가져오기(마이그레이션) 엔티티 스키마 — 클라이언트(템플릿·미리보기·안내)와
 * 서버(검증 매핑)가 공유하는 단일 정의.
 */
export type ImportEntity = 'members' | 'instructors' | 'lessons' | 'transactions'

export interface ImportColumn {
  header: string      // CSV 헤더명(한국어)
  required: boolean
  example: string
  hint?: string
}

export interface ImportSchema {
  entity: ImportEntity
  label: string
  columns: ImportColumn[]
  note?: string
}

export const IMPORT_ENTITIES: ImportEntity[] = ['members', 'instructors', 'lessons', 'transactions']

export const IMPORT_SCHEMAS: Record<ImportEntity, ImportSchema> = {
  members: {
    entity: 'members',
    label: '회원',
    columns: [
      { header: '이름', required: true, example: '홍길동' },
      { header: '전화번호', required: false, example: '010-1234-5678' },
      { header: '이메일', required: false, example: 'hong@example.com' },
      { header: '성별', required: false, example: '여' },
      { header: '생년월일', required: false, example: '1990-01-15', hint: 'YYYY-MM-DD' },
      { header: '주소', required: false, example: '서울 강남구' },
      { header: '등급', required: false, example: 'VIP' },
      { header: '메모', required: false, example: '' },
    ],
  },
  instructors: {
    entity: 'instructors',
    label: '강사',
    columns: [
      { header: '이름', required: true, example: '김강사' },
      { header: '전화번호', required: false, example: '010-2222-3333' },
      { header: '역할', required: false, example: 'instructor', hint: 'owner/admin/instructor · 비우면 instructor' },
      { header: '기본시급', required: false, example: '30000' },
      { header: '개인시급', required: false, example: '35000' },
      { header: '재활시급', required: false, example: '40000' },
      { header: '듀엣시급', required: false, example: '25000' },
      { header: '그룹시급', required: false, example: '20000' },
    ],
  },
  lessons: {
    entity: 'lessons',
    label: '수업(일정)',
    columns: [
      { header: '회원이름', required: true, example: '홍길동' },
      { header: '날짜', required: true, example: '2026-03-15', hint: 'YYYY-MM-DD' },
      { header: '시간', required: false, example: '14:00' },
      { header: '강사이름', required: false, example: '김강사' },
      { header: '시간(분)', required: false, example: '50' },
      { header: '메모', required: false, example: '' },
    ],
    note: '회원·강사를 먼저 가져온 뒤 import 하세요. 이름으로 매칭합니다(못 찾으면 그 줄만 건너뜀).',
  },
  transactions: {
    entity: 'transactions',
    label: '매출/지출',
    columns: [
      { header: '날짜', required: true, example: '2026-03-15', hint: 'YYYY-MM-DD' },
      { header: '카테고리', required: true, example: '매출', hint: "매출은 '매출', 비용은 임대료·마케팅비 등" },
      { header: '금액', required: true, example: '500000', hint: '양수로 입력 (매출/지출은 카테고리로 구분)' },
      { header: '결제수단', required: false, example: '카드', hint: '카드/계좌이체/현금' },
      { header: '거래처', required: false, example: '' },
      { header: '메모', required: false, example: '' },
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
