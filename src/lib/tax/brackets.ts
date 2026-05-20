/**
 * 한국 종합소득세 누진세율 표 (2024 개정 기준).
 *
 * 계산 방식: 과세표준 × 세율 - 누진공제
 *   (구간별로 단순 곱하기-누진공제하는 공식과 등가)
 *
 * 구간별 누진공제는 미리 계산된 상수.
 */
export const TAX_BRACKETS = [
  { upTo: 14_000_000,    rate: 0.06, deduction: 0 },
  { upTo: 50_000_000,    rate: 0.15, deduction: 1_260_000 },
  { upTo: 88_000_000,    rate: 0.24, deduction: 5_760_000 },
  { upTo: 150_000_000,   rate: 0.35, deduction: 15_440_000 },
  { upTo: 300_000_000,   rate: 0.38, deduction: 19_940_000 },
  { upTo: 500_000_000,   rate: 0.40, deduction: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { upTo: Infinity,      rate: 0.45, deduction: 65_940_000 },
] as const

export function computeBracketTax(taxableBase: number): number {
  if (taxableBase <= 0) return 0
  const bracket = TAX_BRACKETS.find(b => taxableBase <= b.upTo)!
  return Math.round(taxableBase * bracket.rate - bracket.deduction)
}
