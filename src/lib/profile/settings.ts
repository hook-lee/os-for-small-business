import { getSupabaseClient, hasSupabaseConfig } from '@/lib/supabase/client'

export interface UserProfile {
  workspaceName: string | null   // 센터명 (가입 시 필수, 예: '라파 필라테스')
  role: string | null            // 직급 (가입 시 필수: '원장' / '매니저' / '강사' / 기타)
  businessPhone: string | null   // 센터 전화번호 (선택)
  businessAddress: string | null // 센터 주소 (선택)
  birthDate: string | null
  isYoungStartupEligible: boolean
  youngStartupReductionRate: 0 | 0.5 | 1.0
  noranusanAnnualContribution: number
  pensionAnnualContribution: number
  taxPayerType: 'general' | 'simplified'
}

export const DEFAULT_PROFILE: UserProfile = {
  workspaceName: null,
  role: null,
  businessPhone: null,
  businessAddress: null,
  birthDate: null,
  isYoungStartupEligible: false,
  youngStartupReductionRate: 0,
  noranusanAnnualContribution: 0,
  pensionAnnualContribution: 0,
  taxPayerType: 'general',
}

interface ProfileRow {
  id: number
  workspace_name?: string | null
  role?: string | null
  business_phone?: string | null
  birth_date: string | null
  business_address: string | null
  is_young_startup_eligible: boolean
  young_startup_reduction_rate: string | number
  noranusan_annual_contribution: string | number
  pension_annual_contribution: string | number
  tax_payer_type?: string | null
}

function rowToProfile(row: ProfileRow): UserProfile {
  const rate = Number(row.young_startup_reduction_rate)
  const youngStartupReductionRate: 0 | 0.5 | 1.0 =
    rate === 0.5 ? 0.5 : rate === 1 ? 1.0 : 0
  return {
    workspaceName: row.workspace_name ?? null,
    role: row.role ?? null,
    businessPhone: row.business_phone ?? null,
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
 * 프로필 저장 — INSERT/UPDATE 분기 방식.
 *
 * 왜 upsert 대신 분기?
 * profile.id가 default 1로 박혀있어 새 row insert 시 PK 충돌
 * (라파 owner의 첫 row가 id=1을 차지). owner_id로 직접 select 후 분기.
 *
 * 누락 컬럼 (tax_payer_type, role, business_phone, workspace_name)
 * graceful fallback도 유지.
 */
export async function saveProfile(profile: UserProfile, ownerId: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase 미설정 — SUPABASE_URL/SERVICE_ROLE_KEY 환경변수 필요')
  }
  if (ownerId === 'no-auth') {
    throw new Error('로그인이 필요합니다 (프로필 저장)')
  }
  const supabase = getSupabaseClient()
  const fullFields: Record<string, unknown> = {
    owner_id: ownerId,
    workspace_name: profile.workspaceName,
    role: profile.role,
    business_phone: profile.businessPhone,
    birth_date: profile.birthDate,
    business_address: profile.businessAddress,
    is_young_startup_eligible: profile.isYoungStartupEligible,
    young_startup_reduction_rate: profile.youngStartupReductionRate,
    noranusan_annual_contribution: profile.noranusanAnnualContribution,
    pension_annual_contribution: profile.pensionAnnualContribution,
    tax_payer_type: profile.taxPayerType ?? 'general',
    updated_at: new Date().toISOString(),
  }

  // 1. 기존 row 확인
  const { data: existing } = await supabase
    .from('profile')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle()

  // 컬럼 누락 시 retry 헬퍼
  const retryWithoutMissingCols = async (
    error: { message: string },
    op: (fields: Record<string, unknown>) => Promise<{ error: { message: string } | null }>,
  ): Promise<void> => {
    const msg = error.message
    const missing: string[] = []
    for (const col of ['workspace_name', 'role', 'business_phone', 'tax_payer_type']) {
      if (msg.includes(col)) missing.push(col)
    }
    if (missing.length === 0) throw new Error(`프로필 저장 실패: ${msg}`)
    const retry = { ...fullFields }
    for (const c of missing) delete retry[c]
    const { error: retryErr } = await op(retry)
    if (retryErr) throw new Error(`프로필 저장 실패: ${retryErr.message}`)
    console.warn(`[profile] 누락 컬럼 ${missing.join(', ')} — 마이그레이션 필요`)
  }

  if (existing) {
    // 2a. UPDATE
    const { error } = await supabase
      .from('profile')
      .update(fullFields)
      .eq('owner_id', ownerId)
    if (!error) return
    await retryWithoutMissingCols(error, async (fields) => {
      return supabase.from('profile').update(fields).eq('owner_id', ownerId)
    })
  } else {
    // 2b. INSERT
    // 1차: id 생략 (DB default sequence 의존 — v3.2 마이그레이션 후 동작)
    const { error: e1 } = await supabase.from('profile').insert(fullFields)
    if (!e1) return

    // 2차: profile_id_check 제약이 아직 남아 있으면(id=1 강제) → 회피
    //      DB 마이그레이션(v3.2) 미실행 환경 대비 fallback
    const isCheckConstraint = e1.message.includes('profile_id_check') || e1.message.includes('check constraint')
    const isPkDup = e1.message.includes('profile_pkey') || e1.message.includes('duplicate key')
    if (isCheckConstraint || isPkDup) {
      const { data: maxRow } = await supabase
        .from('profile')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      const newId = ((maxRow as { id: number } | null)?.id ?? 0) + 1
      const { error: e2 } = await supabase.from('profile').insert({ ...fullFields, id: newId })
      if (!e2) return
      // 컬럼 누락 + 제약 회피 동시에
      await retryWithoutMissingCols(e2, async (fields) => {
        return supabase.from('profile').insert({ ...fields, id: newId })
      })
      return
    }

    // 3차: 컬럼 누락 case
    await retryWithoutMissingCols(e1, async (fields) => {
      return supabase.from('profile').insert(fields)
    })
  }
}
