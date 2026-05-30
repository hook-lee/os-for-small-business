/**
 * 스튜디오 운영 설정 (owner당 1행, jsonb 저장).
 *
 * 17개+ 설정을 jsonb 하나에 저장 → 새 설정 추가 시 DB 마이그레이션 불필요.
 * 코드 측 타입(StudioSettings)으로 안전성 확보.
 *
 * partial 저장: 사용자가 일부만 변경해도 나머지는 default와 병합되어 유지.
 */
import { getSupabaseClient, hasSupabaseConfig } from './client'

// ─────────────────────────────────────────────
// 타입 정의 — 17개 설정
// ─────────────────────────────────────────────

export interface StudioSettings {
  // 01. 예약·취소 가능 시간 (수업 시작 X시간 Y분 전까지)
  privateBookingHoursBefore: number      // 프라이빗 예약 가능: 시작 24h 전까지
  privateBookingMinutesBefore: number
  groupBookingHoursBefore: number        // 그룹 예약 가능: 시작 0h 전까지
  groupBookingMinutesBefore: number
  privateCancelHoursBefore: number       // 프라이빗 취소: 시작 6h 전까지
  privateCancelMinutesBefore: number
  groupCancelHoursBefore: number         // 그룹 취소: 시작 0h 전까지
  groupCancelMinutesBefore: number

  // 02. 당일 예약 변경 가능 시간 (그룹)
  groupChangeHoursAfterStart: number      // 수업 시작 6시간 후까지 변경 가능

  // 03. 폐강 시간 (최소 인원 미달 시 자동 취소)
  autoCloseHoursBeforeStart: number       // 시작 0시간 전 폐강

  // 04. 예약대기 자동 예약 시간
  waitlistAutoBookHoursBefore: number     // 시작 0시간 전 자동 예약

  // 05. 예약대기 횟수 제한
  waitlistMaxCount: number                // 한 회원이 동시에 대기할 수 있는 최대 횟수

  // 06. 일별 예약 가능 횟수 제한
  dailyBookingLimitType: 'pass' | 'date'  // 'pass'=수강권별 제한 / 'date'=날짜별 회원
  dailyBookingMaxGroupCount: number       // 회원은 하루에 최대 N개 그룹 수업 예약 가능

  // 07. 예약 가능 기간
  privateBookableDaysAhead: number        // 프라이빗: 시작일 X일 전부터 예약 가능
  privateBookableTimeOfDay: string        // 'HH:MM' 형식
  groupBookableDaysAhead: number          // 그룹: 시작일 X일 전부터 예약 가능
  groupBookableTimeOfDay: string

  // 08. 프라이빗 예약 시간 단위
  privateBookingTimeUnit: 'flexible' | '30' | '20' | '15' | '10' | '5'

  // 09. 프라이빗 결제 최대 개수
  privateMaxConcurrentPasses: number      // 동시 보유 가능 수강권 수

  // 10. 그룹 수업 예약대기 인원 표시
  showWaitlistCountForReserved: boolean   // 예약 완료한 회원에게 대기 인원 표시
  showWaitlistCountForWaitlisted: boolean // 대기 중인 회원에게 인원 표시

  // 11. 문자 게시판 사용
  useMessageBoard: boolean

  // 12. 모든 수업 보기 사용
  showAllLessons: boolean                 // 회원이 자기 수강권으로 들을 수 없는 수업도 표시

  // 13. 학적 사용
  useAcademicRecord: boolean

  // 14. 횟수 차감되지 취소 설정
  useCancelWithoutDeduction: boolean      // 일정 시간 이전 취소 시 회차 차감 X

  // 15. 회원앱에서 만료된 수강권 숨기기
  hideExpiredPassesFromMembers: boolean

  // 16. 수강권 미수금 자동 입력
  autoFillUnpaidAmount: boolean

  // 17. 회원앱 라운지 사용
  useMemberAppLounge: boolean
}

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  privateBookingHoursBefore: 24,
  privateBookingMinutesBefore: 0,
  groupBookingHoursBefore: 0,
  groupBookingMinutesBefore: 0,
  privateCancelHoursBefore: 6,
  privateCancelMinutesBefore: 0,
  groupCancelHoursBefore: 0,
  groupCancelMinutesBefore: 0,

  groupChangeHoursAfterStart: 6,
  autoCloseHoursBeforeStart: 0,
  waitlistAutoBookHoursBefore: 0,
  waitlistMaxCount: 5,
  dailyBookingLimitType: 'pass',
  dailyBookingMaxGroupCount: 1,
  privateBookableDaysAhead: 7,
  privateBookableTimeOfDay: '03:00',
  groupBookableDaysAhead: 7,
  groupBookableTimeOfDay: '03:00',
  privateBookingTimeUnit: 'flexible',
  privateMaxConcurrentPasses: 0,        // 0 = 무제한
  showWaitlistCountForReserved: true,
  showWaitlistCountForWaitlisted: true,
  useMessageBoard: false,
  showAllLessons: false,
  useAcademicRecord: false,
  useCancelWithoutDeduction: false,
  hideExpiredPassesFromMembers: true,
  autoFillUnpaidAmount: true,
  useMemberAppLounge: false,
}

interface StudioSettingsRow {
  owner_id: string
  settings: Partial<StudioSettings>
  updated_at: string
}

/**
 * 설정 읽기. 미저장 키는 default 값으로 채워서 반환 (병합).
 */
export async function loadStudioSettings(ownerId: string): Promise<StudioSettings> {
  if (!hasSupabaseConfig()) return DEFAULT_STUDIO_SETTINGS
  if (ownerId === 'no-auth') return DEFAULT_STUDIO_SETTINGS
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('studio_settings')
      .select('settings')
      .eq('owner_id', ownerId)
      .maybeSingle()
    if (error || !data) return DEFAULT_STUDIO_SETTINGS
    const row = data as Pick<StudioSettingsRow, 'settings'>
    return { ...DEFAULT_STUDIO_SETTINGS, ...(row.settings ?? {}) }
  } catch {
    return DEFAULT_STUDIO_SETTINGS
  }
}

/**
 * 설정 저장 (전체 또는 partial). UPSERT (owner_id PK).
 */
export async function saveStudioSettings(
  patch: Partial<StudioSettings>,
  ownerId: string,
): Promise<void> {
  if (!hasSupabaseConfig()) throw new Error('Supabase 미설정')
  if (ownerId === 'no-auth') throw new Error('로그인이 필요합니다')

  const supabase = getSupabaseClient()
  // 기존 설정과 병합 (사용자가 일부만 변경해도 나머지 유지)
  const current = await loadStudioSettings(ownerId)
  const merged = { ...current, ...patch }

  const { error } = await supabase
    .from('studio_settings')
    .upsert({
      owner_id: ownerId,
      settings: merged,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id' })
  if (error) throw new Error(`스튜디오 설정 저장 실패: ${error.message}`)
}
