import { describe, it, expect } from 'vitest'
import { normalizeHeader, guessMapping, applyMapping } from '@/lib/import/match'
import { IMPORT_SCHEMAS } from '@/lib/import/schema'

const memberCols = IMPORT_SCHEMAS.members.columns

describe('normalizeHeader', () => {
  it('공백·구분기호 제거 + 소문자', () => {
    expect(normalizeHeader('전화 번호')).toBe('전화번호')
    expect(normalizeHeader('Phone-Number')).toBe('phonenumber')
    expect(normalizeHeader('연락처_1')).toBe('연락처1')
  })
})

describe('guessMapping (members)', () => {
  it('표준 헤더 그대로면 1:1 매핑', () => {
    const m = guessMapping(['이름', '전화번호', '이메일'], memberCols)
    expect(m['이름']).toBe('이름')
    expect(m['전화번호']).toBe('전화번호')
    expect(m['이메일']).toBe('이메일')
  })

  it('다른 SaaS 별칭 자동 인식', () => {
    const m = guessMapping(['성함', '연락처', '생일', '비고'], memberCols)
    expect(m['이름']).toBe('성함')
    expect(m['전화번호']).toBe('연락처')
    expect(m['생년월일']).toBe('생일')
    expect(m['메모']).toBe('비고')
  })

  it('영문 헤더 인식', () => {
    const m = guessMapping(['Name', 'Mobile', 'Email'], memberCols)
    expect(m['이름']).toBe('Name')
    expect(m['전화번호']).toBe('Mobile')
    expect(m['이메일']).toBe('Email')
  })

  it('알 수 없는 헤더는 null', () => {
    const m = guessMapping(['회원ID', '엄청이상한칼럼'], memberCols)
    expect(m['이름']).toBeNull()
  })

  it('한 CSV 헤더가 두 컬럼에 중복 배정되지 않음', () => {
    const m = guessMapping(['이름', '회원명'], memberCols)
    const assigned = Object.values(m).filter(Boolean)
    expect(new Set(assigned).size).toBe(assigned.length)
  })
})

describe('applyMapping', () => {
  it('매핑대로 표준 컬럼 행 생성', () => {
    const rows = [{ 성함: '홍길동', 연락처: '010-1' }]
    const mapping = { 이름: '성함', 전화번호: '연락처' }
    const out = applyMapping(rows, memberCols, mapping)
    expect(out[0]['이름']).toBe('홍길동')
    expect(out[0]['전화번호']).toBe('010-1')
    expect(out[0]['이메일']).toBe('') // 매핑 안 됨
  })
})
