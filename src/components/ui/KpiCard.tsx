import { StatNumber } from './StatNumber'

interface KpiCardProps {
  title: string
  amount: number
  subtitle?: string
  unit?: string
}

export function KpiCard({ title, amount, subtitle, unit = '원' }: KpiCardProps) {
  const isNegative = amount < 0
  // p-3(여유 패딩 축소)으로 좁은 칸에서도 숫자가 들어갈 자리를 확보.
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-neutral-500">{title}</div>
      <StatNumber amount={amount} unit={unit} className={`mt-1 ${isNegative ? 'text-red-600' : 'text-neutral-900'}`} />
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </div>
  )
}
