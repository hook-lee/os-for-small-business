import { loadTransactions } from '@/lib/data/loader'
import { aggregateMonthly } from '@/lib/analytics/monthly'
import { KpiCard } from '@/components/ui/KpiCard'
import { MonthlyBarChart } from '@/components/Charts/MonthlyBarChart'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export default async function AnalyticsPage() {
  const transactions = await loadTransactions()
  const monthly = aggregateMonthly(transactions)
  const currentYear = new Date().getFullYear()

  function yearTotals(year: number) {
    const filtered = monthly.filter(m => m.month.startsWith(year.toString()))
    return {
      revenue: filtered.reduce((s, m) => s + m.revenue, 0),
      expense: filtered.reduce((s, m) => s + m.expense, 0),
      net: filtered.reduce((s, m) => s + m.net, 0),
      ownerDraw: filtered.reduce((s, m) => s + m.ownerDraw, 0),
      reserve: filtered.reduce((s, m) => s + m.reserve, 0),
    }
  }

  const years = [currentYear, currentYear - 1, currentYear - 2]

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-3">연도별 KPI</h2>
        {years.map(year => {
          const t = yearTotals(year)
          if (t.revenue === 0 && t.expense === 0) return null
          return (
            <div key={year} className="mb-4">
              <div className="text-sm font-medium text-neutral-600 mb-2">{year}년</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard title="매출" amount={t.revenue} />
                <KpiCard title="지출" amount={-t.expense} />
                <KpiCard title="순이익" amount={t.net} />
                <KpiCard title="유진 급여" amount={t.ownerDraw} />
                <KpiCard title="예비비" amount={t.reserve} />
              </div>
            </div>
          )
        })}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">월별 추세</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MonthlyBarChart
            data={monthly.map(m => ({ month: m.month, amount: m.revenue }))}
            title="월별 매출"
            color="#2563eb"
          />
          <MonthlyBarChart
            data={monthly.map(m => ({ month: m.month, amount: m.expense }))}
            title="월별 지출"
            color="#dc2626"
          />
        </div>
        <div className="mt-4">
          <MonthlyBarChart
            data={monthly.map(m => ({ month: m.month, amount: m.net }))}
            title="월별 순이익"
            color="#16a34a"
          />
        </div>
      </section>
    </div>
  )
}
