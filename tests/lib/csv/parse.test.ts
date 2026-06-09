import { describe, it, expect } from 'vitest'
import { parseCSV, csvToObjects } from '@/lib/csv/parse'

describe('parseCSV', () => {
  it('기본 콤마 분리', () => {
    expect(parseCSV('a,b,c')).toEqual([['a', 'b', 'c']])
  })

  it('여러 행 (LF/CRLF)', () => {
    expect(parseCSV('a,b\r\nc,d\n')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('따옴표 안의 콤마는 분리 안 함', () => {
    expect(parseCSV('"홍길동, 님",010')).toEqual([['홍길동, 님', '010']])
  })

  it('따옴표 안의 줄바꿈 보존', () => {
    expect(parseCSV('"a\nb",c')).toEqual([['a\nb', 'c']])
  })

  it('"" 이스케이프 → 리터럴 따옴표', () => {
    expect(parseCSV('"그는 ""안녕"" 했다",x')).toEqual([['그는 "안녕" 했다', 'x']])
  })

  it('BOM 제거', () => {
    expect(parseCSV('﻿이름,전화')).toEqual([['이름', '전화']])
  })
})

describe('csvToObjects', () => {
  it('헤더 기준 객체화 + trim', () => {
    const { headers, rows } = csvToObjects('이름, 전화번호\n 홍길동 ,010-1\n김철수,010-2\n')
    expect(headers).toEqual(['이름', '전화번호'])
    expect(rows).toEqual([
      { 이름: '홍길동', 전화번호: '010-1' },
      { 이름: '김철수', 전화번호: '010-2' },
    ])
  })

  it('완전히 빈 행은 제외', () => {
    const { rows } = csvToObjects('이름\n홍길동\n\n\n김철수\n')
    expect(rows.map(r => r['이름'])).toEqual(['홍길동', '김철수'])
  })

  it('빈 입력 → 빈 결과', () => {
    expect(csvToObjects('')).toEqual({ headers: [], rows: [] })
  })
})
