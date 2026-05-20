import { Card } from './Card'

interface KpiCardProps {
  title: string
  amount: number
  subtitle?: string
  unit?: string
}

export function KpiCard({ title, amount, subtitle, unit = '원' }: KpiCardProps) {
  const isNegative = amount < 0
  return (
    <Card>
      <div className="text-xs text-neutral-500">{title}</div>
      <div className={`text-2xl font-bold mt-1 ${isNegative ? 'text-red-600' : 'text-neutral-900'}`}>
        {amount.toLocaleString()}
        <span className="text-sm font-normal ml-1">{unit}</span>
      </div>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </Card>
  )
}
