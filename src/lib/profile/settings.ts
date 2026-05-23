import { getSupabaseClient, hasSupabaseConfig } from '@/lib/supabase/client'

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

interface ProfileRow {
  id: number
  birth_date: string | null
  business_address: string | null
  is_young_startup_eligible: boolean
  young_startup_reduction_rate: string | number  // PostgREST는 numeric을 문자열로 줌
  noranusan_annual_contribution: string | number
  pension_annual_contribution: string | number
}

function rowToProfile(row: ProfileRow): UserProfile {
  const rate = Number(row.young_startup_reduction_rate)
  const youngStartupReductionRate: 0 | 0.5 | 1.0 =
    rate === 0.5 ? 0.5 : rate === 1 ? 1.0 : 0
  return {
    birthDate: row.birth_date,
    businessAddress: row.business_address,
    isYoungStartupEligible: row.is_young_startup_eligible,
    youngStartupReductionRate,
    noranusanAnnualContribution: Number(row.noranusan_annual_contribution),
    pensionAnnualContribution: Number(row.pension_annual_contribution),
  }
}

/**
 * 프로필 읽기. Supabase 미설정/오류/테이블 부재 시 DEFAULT_PROFILE 반환 (앱은 계속 동작).
 */
export async function loadProfile(): Promise<UserProfile> {
  if (!hasSupabaseConfig()) return DEFAULT_PROFILE
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('profile')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return DEFAULT_PROFILE
    return rowToProfile(data as ProfileRow)
  } catch {
    return DEFAULT_PROFILE
  }
}

/**
 * 프로필 저장 (upsert, id=1 고정). 실패 시 throw — API route가 400/500 응답.
 * Vercel serverless는 fs write가 불가능해 Supabase로 영속.
 */
export async function saveProfile(profile: UserProfile): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase 미설정 — SUPABASE_URL/SERVICE_ROLE_KEY 환경변수 필요')
  }
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('profile')
    .upsert(
      {
        id: 1,
        birth_date: profile.birthDate,
        business_address: profile.businessAddress,
        is_young_startup_eligible: profile.isYoungStartupEligible,
        young_startup_reduction_rate: profile.youngStartupReductionRate,
        noranusan_annual_contribution: profile.noranusanAnnualContribution,
        pension_annual_contribution: profile.pensionAnnualContribution,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
  if (error) throw new Error(`프로필 저장 실패: ${error.message}`)
}
