export type PayrollCategory = 'private' | 'rehab' | 'duet' | 'group'

export function passNameToPayrollCategory(passName: string | null | undefined): PayrollCategory {
  if (!passName) return 'private'
  if (passName.includes('재활')) return 'rehab'
  if (passName.includes('듀엣')) return 'duet'
  if (passName.includes('그룹') || passName.includes('소그룹')) return 'group'
  return 'private'
}

export function bucketLessonCounts(
  individualPassNames: Array<string | null>,
  groupSessionCount: number,
): { privateCount: number; rehabCount: number; duetCount: number; groupCount: number } {
  const counts = { privateCount: 0, rehabCount: 0, duetCount: 0, groupCount: 0 }
  for (const name of individualPassNames) {
    const cat = passNameToPayrollCategory(name)
    if (cat === 'private') counts.privateCount++
    else if (cat === 'rehab') counts.rehabCount++
    else if (cat === 'duet') counts.duetCount++
    else if (cat === 'group') counts.groupCount++
  }
  counts.groupCount += groupSessionCount
  return counts
}
