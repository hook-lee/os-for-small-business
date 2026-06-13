'use client'

import { useRouter, usePathname } from 'next/navigation'
import { InstructorsTable } from './InstructorsTable'
import { InstructorScorecard } from './InstructorScorecard'
import { PayrollTable } from '../payroll/PayrollTable'
import type { Instructor } from '@/lib/supabase/instructors'
import type { PayrollRecord } from '@/lib/supabase/payroll'
import type { InstructorScorecardRow } from '@/lib/analytics/instructor-scorecard'
import type { PeriodKey } from '@/lib/analytics/period'

type Tab = 'list' | 'payroll' | 'scorecard'

export function InstructorsTabs({
  tab,
  instructors,
  memberCounts,
  revenueByInstructor,
  payrollMonth,
  payrollRecords,
  scorecards,
  periodKey,
  categories,
}: {
  tab: Tab
  instructors: Instructor[]
  memberCounts: Record<number, number>
  revenueByInstructor: Record<number, number>
  payrollMonth: string
  payrollRecords: PayrollRecord[]
  scorecards: InstructorScorecardRow[]
  periodKey: PeriodKey
  categories: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-neutral-200 overflow-x-auto">
        <TabButton active={tab === 'list'} onClick={() => router.push(pathname)}>강사 목록</TabButton>
        <TabButton active={tab === 'scorecard'} onClick={() => router.push(`${pathname}?tab=scorecard`)}>강사 성과</TabButton>
        <TabButton active={tab === 'payroll'} onClick={() => router.push(`${pathname}?tab=payroll`)}>월별 급여 정산</TabButton>
      </div>

      {tab === 'list' && (
        <InstructorsTable
          instructors={instructors}
          memberCounts={memberCounts}
          revenueByInstructor={revenueByInstructor}
          categories={categories}
        />
      )}
      {tab === 'scorecard' && (
        <InstructorScorecard rows={scorecards} periodKey={periodKey} />
      )}
      {tab === 'payroll' && (
        <PayrollTable
          initialMonth={payrollMonth}
          instructors={instructors}
          initialRecords={payrollRecords}
          basePath="/instructors"
          categories={categories}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
      }`}
    >
      {children}
    </button>
  )
}
