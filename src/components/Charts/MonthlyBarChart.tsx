'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export interface MonthlyDatum {
  month: string  // YYYY-MM
  amount: number
}

interface MonthlyBarChartProps {
  data: MonthlyDatum[]
  title: string
  color?: string
}

export function MonthlyBarChart({ data, title, color = '#2563eb' }: MonthlyBarChartProps) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm font-medium mb-2">{title}</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="month" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
            <Tooltip formatter={(v) => (typeof v === 'number' ? v.toLocaleString() + '원' : v)} />
            <Bar dataKey="amount" fill={color} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
