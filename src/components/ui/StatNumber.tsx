interface StatNumberProps {
  amount: number
  unit?: string
  /** card=일반 지표 카드(기본), hero=대표 큰 숫자(홈·세금 상단) */
  size?: 'card' | 'hero'
  className?: string
}

/**
 * 금액 숫자 표시 — 어떤 칸 너비에서도 박스를 넘치지 않도록 보장하는 공용 컴포넌트.
 *
 * 넘침 방지 3중 장치:
 *  1) 보수적 반응형 폰트(좁은 칸 기준). card=text-base→lg, hero=text-xl→2xl.
 *  2) tabular-nums + tracking-tight → 숫자 폭 최소화.
 *  3) 단위(원)는 줄바꿈 허용 = 안전밸브. 정말 좁으면 '원'만 아랫줄로 내려가고 박스 밖으로 안 나간다.
 *
 * 색은 className으로 제어(음수 빨강 등은 호출부 책임). 숫자 자체는 통화 토큰이라 중간에서 안 끊긴다.
 */
export function StatNumber({ amount, unit = '원', size = 'card', className = '' }: StatNumberProps) {
  const sizeCls = size === 'hero' ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
  return (
    <span className={`inline-block font-bold tabular-nums tracking-tight leading-snug ${sizeCls} ${className}`}>
      {amount.toLocaleString()}
      <span className="text-xs font-normal"> {unit}</span>
    </span>
  )
}
