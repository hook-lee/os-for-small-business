import { getSupabaseClient, hasSupabaseConfig } from '@/lib/supabase/client'

export interface UserProfile {
  birthDate: string | null
  businessAddress: string | null
  isYoungStartupEligible: boolean
  youngStartupReductionRate: 0 | 0.5 | 1.0
  noranusanAnnualContribution: number
  pensionAnnualContribution: number
  taxPayerType: 'general' | 'simplified'
}

export const DEFAULT_PROFILE: UserProfile = {
  birthDate: null,
  businessAddress: null,
  isYoungStartupEligible: false,
  youngStartupReductionRate: 0,
  noranusanAnnualContribution: 0,
  pensionAnnualContribution: 0,
  taxPayerType: 'general',
}

interface ProfileRow {
  id: number
  birth_date: string | null
  business_address: string | null
  is_young_startup_eligible: boolean
  young_startup_reduction_rate: string | number  // PostgREST는 numeric을 문자열로 줌
  noranusan_annual_contribution: string | number
  pension_annual_contribution: string | number
  tax_payer_type?: string | null
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
    taxPayerType: (row.tax_payer_type === 'simplified' ? 'simplified' : 'general') as 'general' | 'simplified',
  }
}

/**
 * 프로필 읽기 (owner별 1행).
 * Supabase 미설정/오류/테이블 부재/ownerId='no-auth' 시 DEFAULT_PROFILE 반환.
 */
export async function loadProfile(ownerId: string): Promise<UserProfile> {
  if (!hasSupabaseConfig()) return DEFAULT_PROFILE
  if (ownerId === 'no-auth') return DEFAULT_PROFILE
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('profile')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle()
    if (error || !data) return DEFAULT_PROFILE
    return rowToProfile(data as ProfileRow)
  } catch {
    return DEFAULT_PROFILE
  }
}

/**
 * 프로필 저장 (owner_id 기준 upsert). 실패 시 throw.
 *
 * v2.9 마이그레이션(tax_payer_type 컬럼) 미실행 환경 graceful 처리:
 * 컬럼 부재 에러 발생 시 그 필드만 빼고 재시도.
 */
export async function saveProfile(profile: UserProfile, ownerId: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase 미설정 — SUPABASE_URL/SERVICE_ROLE_KEY 환경변수 필요')
  }
  if (ownerId === 'no-auth') {
    throw new Error('로그인이 필요합니다 (프로필 저장)')
  }
  const supabase = getSupabaseClient()
  const baseFields: Record<string, unknown> = {
    owner_id: ownerId,
    birth_date: profile.birthDate,
    business_address: profile.businessAddress,
    is_young_startup_eligible: profile.isYoungStartupEligible,
    young_startup_reduction_rate: profile.youngStartupReductionRate,
    noranusan_annual_contribution: profile.noranusanAnnualContribution,
    pension_annual_contribution: profile.pensionAnnualContribution,
    updated_at: new Date().toISOString(),
  }

  // 1차 시도: tax_payer_type 포함
  const { error } = await supabase
    .from('profile')
    .upsert(
      { ...baseFields, tax_payer_type: profile.taxPayerType ?? 'general' },
      { onConflict: 'owner_id' },
    )

  if (!error) return

  // tax_payer_type 컬럼이 아직 없으면(=v2.9 마이그레이션 미실행) → 그 필드만 빼고 재시도
  const isTaxPayerTypeMissing =
    error.message.includes('tax_payer_type') &&
    (error.message.includes('column') || error.message.includes('schema cache'))

  if (isTaxPayerTypeMissing) {
    const { error: retryError } = await supabase
      .from('profile')
      .upsert(baseFields, { onConflict: 'owner_id' })
    if (retryError) {
      throw new Error(`프로필 저장 실패: ${retryError.message}`)
    }
    // 다른 필드는 저장 성공. tax_payer_type만 누락 → 콘솔 경고
    console.warn('[profile] tax_payer_type 저장 누락: v2.9 마이그레이션 필요 (PENDING-MIGRATIONS.sql)')
    return
  }

  throw new Error(`프로필 저장 실패: ${error.message}`)
}
