import { describe, it, expect } from 'vitest'
import { renderContract, CONTRACT_DEFAULTS, CONTRACT_KINDS, CONTRACT_TARGET } from '@/lib/contracts/defaults'

describe('renderContract 변수 치환', () => {
  it('{{변수}}를 값으로 치환', () => {
    const out = renderContract('{{센터명}} / {{회원명}} / {{날짜}}', {
      센터명: '라파 필라테스', 회원명: '홍길동', 날짜: '2026-06-07',
    })
    expect(out).toBe('라파 필라테스 / 홍길동 / 2026-06-07')
  })
  it('공백 있는 변수도 치환', () => {
    expect(renderContract('{{ 센터명 }}', { 센터명: 'X' })).toBe('X')
  })
  it('알 수 없는 변수는 원형 유지', () => {
    expect(renderContract('{{미정}}', {})).toBe('{{미정}}')
  })
  it('반복 변수 모두 치환', () => {
    expect(renderContract('{{a}}-{{a}}', { a: '1' })).toBe('1-1')
  })
})

describe('기본 샘플', () => {
  it('4종 모두 title·body 존재', () => {
    for (const kind of CONTRACT_KINDS) {
      expect(CONTRACT_DEFAULTS[kind].title.length).toBeGreaterThan(0)
      expect(CONTRACT_DEFAULTS[kind].body.length).toBeGreaterThan(20)
    }
  })
  it('강사 계약만 instructor 대상', () => {
    expect(CONTRACT_TARGET.instructor).toBe('instructor')
    expect(CONTRACT_TARGET.member_terms).toBe('member')
  })
})
