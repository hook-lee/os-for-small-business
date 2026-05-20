import { promises as fs } from 'fs'
import { join } from 'path'

export interface UserProfile {
  birthDate: string | null
  businessAddress: string | null
  isYoungStartupEligible: boolean
  youngStartupReductionRate: 0 | 0.5 | 1.0
  noranusanAnnualContribution: number
  pensionAnnualContribution: number
}

export const DEFAULT_PROFILE: UserProfile = {
  birthDate: null,
  businessAddress: null,
  isYoungStartupEligible: false,
  youngStartupReductionRate: 0,
  noranusanAnnualContribution: 0,
  pensionAnnualContribution: 0,
}

const PROFILE_PATH = join(process.cwd(), 'data', 'profile.json')

export async function loadProfile(): Promise<UserProfile> {
  try {
    const raw = await fs.readFile(PROFILE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<UserProfile>
    return { ...DEFAULT_PROFILE, ...parsed }
  } catch {
    return DEFAULT_PROFILE
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await fs.mkdir(join(process.cwd(), 'data'), { recursive: true })
  await fs.writeFile(PROFILE_PATH, JSON.stringify(profile, null, 2), 'utf8')
}
