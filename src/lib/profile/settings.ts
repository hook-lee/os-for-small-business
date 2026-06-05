import { getSupabaseClient, hasSupabaseConfig } from '@/lib/supabase/client'

/**
 * 연간 목표 (올해 KPI 목표). 각 항목 null = 미설정.
 * 금액은 원, 인원은 명, 비율은 0~1.
 */
export interface AnnualGoal {
  revenue: number | null              // 연 매출 목표 (원)
  netProfit: number | null            // 순이익 목표 (원)
  activeMembers: number | null        // 활성 회원 목표 (명)
  newMembers: number | null           // 신규 회원 목표 (명/연)
  trialConversionRate: number | null  // 체험→등록 전환율 목표 (0~1)
  reregistrationRate: number | null   // 재등록률 목표 (0~1)
}

export const EMPTY_ANNUAL_GOAL: AnnualGoal = {
  revenue: null,
  netProfit: null,
  activeMembers: null,
  newMembers: null,
  trialConversionRate: null,
  reregistrationRate: null,
}

/** 연도(YYYY) → 목표 매핑 sanitize. 잘못된 값은 null 처리. */
export function sanitizeAnnualGoals(raw: unknown): Record<string, AnnualGoal> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, AnnualGoal> = {}
  for (const [year, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(year)) continue
    if (!val || typeof val !== 'object') continue
    const g = val as Record<string, unknown>
    const num = (v: unknown, opts?: { rate?: boolean }): number | null => {
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0) return null
      if (opts?.rate) return n > 1 ? Math.min(n / 100, 1) : n  // 0~100 입력도 0~1로 정규화
      return n
    }
    out[year] = {
      revenue: num(g.revenue),
      netProfit: num(g.netProfit),
      activeMembers: g.activeMembers == null ? null : Math.floor(num(g.activeMembers) ?? 0) || null,
      newMembers: g.newMembers == null ? null : Math.floor(num(g.newMembers) ?? 0) || null,
      trialConversionRate: num(g.trialConversionRate, { rate: true }),
      reregistrationRate: num(g.reregistrationRate, { rate: true }),
    }
  }
  return out
}

/** 원장이 종(알림)에서 받을 알림 종류 ON/OFF. */
export interface NotificationSettings {
  lowRemaining: boolean       // 잔여 N회 이하
  expiring: boolean           // 만료 임박
  dormant: boolean            // 휴면 회원
  unpaidInstructors: boolean  // 미정산 강사
  payrollDday: boolean        // 강사 월급 지급일 D-1/D-day
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  lowRemaining: true,
  expiring: true,
  dormant: true,
  unpaidInstructors: true,
  payrollDday: false,   // 지급일 설정 전엔 기본 꺼둠
}

export function sanitizeNotificationSettings(raw: unknown): NotificationSettings {
  const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const b = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
  return {
    lowRemaining: b(r.lowRemaining, true),
    expiring: b(r.expiring, true),
    dormant: b(r.dormant, true),
    unpaidInstructors: b(r.unpaidInstructors, true),
    payrollDday: b(r.payrollDday, false),
  }
}

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
  personalDeductionCount: number       // 인적공제 인원 (본인 포함, 1인당 150만). 기본 1 = 본인만
  taxPayerType: 'general' | 'simplified'
  taxStartMonth: string | null         // 사업 개시 연월 'YYYY-MM' (과세 타임라인 시작점)
  taxGeneralSinceMonth: string | null  // 일반과세 전환 연월 'YYYY-MM'. null이면 전환 없음
  annualGoals: Record<string, AnnualGoal>  // 연도(YYYY) → 연간 KPI 목표. 기본 {} = 미설정
  lowRemainingThreshold: number        // 잔여 N회 이하면 홈에서 알림. 기본 3. 0이면 끔
  notificationSettings: NotificationSettings  // 종(알림)에서 받을 알림 종류
  payrollDay: number | null            // 강사 월급 지급일 (매월 1~31). null이면 미설정
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
  personalDeductionCount: 1,    // 본인 1명 (보수적 기본값)
  taxPayerType: 'simplified',   // 신규 소규모 사업자 기본값 = 간이과세자
  taxStartMonth: null,
  taxGeneralSinceMonth: null,
  annualGoals: {},
  lowRemainingThreshold: 3,
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  payrollDay: null,
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
  personal_deduction_count?: string | number | null
  tax_payer_type?: string | null
  tax_start_month?: string | null
  tax_general_since_month?: string | null
  annual_goals?: Record<string, unknown> | string | null
  low_remaining_threshold?: string | number | null
  notification_settings?: Record<string, unknown> | string | null
  payroll_day?: string | number | null
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
    personalDeductionCount: row.personal_deduction_count == null ? 1 : Math.max(1, Number(row.personal_deduction_count)),
    taxPayerType: (row.tax_payer_type === 'simplified' ? 'simplified' : 'general') as 'general' | 'simplified',
    taxStartMonth: row.tax_start_month ?? null,
    taxGeneralSinceMonth: row.tax_general_since_month ?? null,
    annualGoals: sanitizeAnnualGoals(
      typeof row.annual_goals === 'string' ? safeJsonParse(row.annual_goals) : row.annual_goals,
    ),
    lowRemainingThreshold: row.low_remaining_threshold == null
      ? 3
      : Math.max(0, Math.floor(Number(row.low_remaining_threshold)) || 0),
    notificationSettings: sanitizeNotificationSettings(
      typeof row.notification_settings === 'string' ? safeJsonParse(row.notification_settings) : row.notification_settings,
    ),
    payrollDay: row.payroll_day == null ? null : Math.min(31, Math.max(1, Math.floor(Number(row.payroll_day)) || 1)),
  }
}

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return {} }
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
    personal_deduction_count: profile.personalDeductionCount ?? 1,
    tax_payer_type: profile.taxPayerType ?? 'general',
    tax_start_month: profile.taxStartMonth ?? null,
    tax_general_since_month: profile.taxGeneralSinceMonth ?? null,
    annual_goals: profile.annualGoals ?? {},
    low_remaining_threshold: profile.lowRemainingThreshold ?? 3,
    notification_settings: profile.notificationSettings ?? DEFAULT_NOTIFICATION_SETTINGS,
    payroll_day: profile.payrollDay ?? null,
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
    for (const col of ['workspace_name', 'role', 'business_phone', 'personal_deduction_count', 'tax_payer_type', 'tax_start_month', 'tax_general_since_month', 'annual_goals', 'low_remaining_threshold', 'notification_settings', 'payroll_day']) {
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
