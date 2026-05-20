import { loadTransactions } from '@/lib/data/loader'
import { loadProfile } from '@/lib/profile/settings'
import { simulateVAT, type Quarter } from '@/lib/tax/vat'
import { recommendReserve } from '@/lib/tax/reserve'
import { getUpcomingDueDates } from '@/lib/tax/due-dates'
import { getActionCards } from '@/lib/advice/action-cards'
import { VATForecastCard } from '@/components/HomeCards/VATForecastCard'
import { ReserveCard } from '@/components/HomeCards/ReserveCard'
import { DueDateBanner } from '@/components/HomeCards/DueDateBanner'
import { ActionCardsList } from '@/components/HomeCards/ActionCardsList'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export default async function HomePage() {
  const [transactions, profile] = await Promise.all([loadTransactions(), loadProfile()])
  const today = new Date().toISOString().slice(0, 10)
  const year = parseInt(today.slice(0, 4), 10)
  const month = parseInt(today.slice(5, 7), 10)
  const quarter = Math.ceil(month / 3) as Quarter

  const vatResult = simulateVAT(transactions, year, quarter)
  const reserveResult = recommendReserve(transactions, today, {
    noranusanContribution: profile.noranusanAnnualContribution,
    pensionSavings: profile.pensionAnnualContribution,
    youngStartupReduction: profile.isYoungStartupEligible ? profile.youngStartupReductionRate : 0,
  })
  const dueDates = getUpcomingDueDates(today)
  const nextDue = dueDates[0]
  const actionCards = getActionCards(transactions, today, {
    noranusanContribution: profile.noranusanAnnualContribution,
    isYoungStartupSet: profile.isYoungStartupEligible,
  })

  return (
    <div className="space-y-4">
      {nextDue && <DueDateBanner due={nextDue} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VATForecastCard result={vatResult} />
        <ReserveCard recommendation={reserveResult} />
      </div>
      <ActionCardsList cards={actionCards} />
    </div>
  )
}
