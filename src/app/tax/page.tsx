import { loadTransactions } from '@/lib/data/loader'
import { loadProfile } from '@/lib/profile/settings'
import { simulateVAT, type Quarter } from '@/lib/tax/vat'
import { simulateIncomeTax } from '@/lib/tax/income-tax'
import { Card } from '@/components/ui/Card'
import { KpiCard } from '@/components/ui/KpiCard'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export default async function TaxPage() {
  const [transactions, profile] = await Promise.all([loadTransactions(), loadProfile()])
  const today = new Date().toISOString().slice(0, 10)
  const year = parseInt(today.slice(0, 4), 10)

  const vatByQuarter = [1, 2, 3, 4].map(q => simulateVAT(transactions, year, q as Quarter))
  const annualVAT = vatByQuarter.reduce((sum, v) => sum + Math.max(0, v.estimatedVAT), 0)
  const incomeTax = simulateIncomeTax(transactions, today, {
    noranusanContribution: profile.noranusanAnnualContribution,
    pensionSavings: profile.pensionAnnualContribution,
    youngStartupReduction: profile.isYoungStartupEligible ? profile.youngStartupReductionRate : 0,
  })

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-3">부가세 (분기별)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {vatByQuarter.map(v => (
            <KpiCard
              key={v.quarter}
              title={`${v.quarter}분기`}
              amount={v.estimatedVAT}
              subtitle={`거래 ${v.transactionCount}건`}
            />
          ))}
        </div>
        <div className="mt-3">
          <KpiCard title={`${year}년 부가세 합계 (예상)`} amount={annualVAT} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">종합소득세 (연환산)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard title="연환산 매출" amount={incomeTax.annualizedRevenue} />
          <KpiCard title="필요경비" amount={-incomeTax.annualizedExpense} />
          <KpiCard title="사업소득금액" amount={incomeTax.businessIncome} />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <KpiCard title="과세표준" amount={incomeTax.taxableBase} />
          <KpiCard title={`${year}년 5월 예상 납부액`} amount={incomeTax.estimatedTax} />
        </div>
        <Card className="mt-3">
          <div className="text-xs text-neutral-500">
            {profile.isYoungStartupEligible
              ? `* 청년창업감면 ${(profile.youngStartupReductionRate * 100).toFixed(0)}% 적용됨`
              : '* 청년창업감면 미적용 — /settings에서 토글 가능'}
            {profile.noranusanAnnualContribution > 0 && ` · 노란우산 ${(profile.noranusanAnnualContribution / 10_000).toFixed(0)}만원 적용`}
            {profile.pensionAnnualContribution > 0 && ` · 연금저축 ${(profile.pensionAnnualContribution / 10_000).toFixed(0)}만원 적용`}
          </div>
        </Card>
      </section>
    </div>
  )
}
