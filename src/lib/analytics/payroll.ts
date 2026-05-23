import type { Instructor } from '@/lib/supabase/instructors'

export interface PayrollCounts {
  privateCount: number
  rehabCount: number
  duetCount: number
  groupCount: number
}

export interface PayrollBreakdown {
  privateTotal: number
  rehabTotal: number
  duetTotal: number
  groupTotal: number
  grossTotal: number  // 4종 합
}

export function computePayrollTotal(instructor: Instructor, counts: PayrollCounts): PayrollBreakdown {
  const privateTotal = counts.privateCount * instructor.ratePrivate
  const rehabTotal = counts.rehabCount * instructor.rateRehab
  const duetTotal = counts.duetCount * instructor.rateDuet
  const groupTotal = counts.groupCount * instructor.rateGroup
  return {
    privateTotal,
    rehabTotal,
    duetTotal,
    groupTotal,
    grossTotal: privateTotal + rehabTotal + duetTotal + groupTotal,
  }
}
