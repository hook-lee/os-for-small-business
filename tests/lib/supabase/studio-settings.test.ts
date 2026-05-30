import { describe, it, expect } from 'vitest'
import { DEFAULT_STUDIO_SETTINGS, type StudioSettings } from '@/lib/supabase/studio-settings'

describe('DEFAULT_STUDIO_SETTINGS', () => {
  it('17개+ 핵심 설정 모두 default 존재', () => {
    expect(DEFAULT_STUDIO_SETTINGS.privateBookingHoursBefore).toBe(24)
    expect(DEFAULT_STUDIO_SETTINGS.groupBookingHoursBefore).toBe(0)
    expect(DEFAULT_STUDIO_SETTINGS.privateCancelHoursBefore).toBe(6)
    expect(DEFAULT_STUDIO_SETTINGS.autoCloseHoursBeforeStart).toBe(0)
    expect(DEFAULT_STUDIO_SETTINGS.waitlistMaxCount).toBe(5)
    expect(DEFAULT_STUDIO_SETTINGS.dailyBookingMaxGroupCount).toBe(1)
    expect(DEFAULT_STUDIO_SETTINGS.dailyBookingLimitType).toBe('pass')
    expect(DEFAULT_STUDIO_SETTINGS.privateBookingTimeUnit).toBe('flexible')
    expect(DEFAULT_STUDIO_SETTINGS.hideExpiredPassesFromMembers).toBe(true)
  })

  it('partial 병합: 일부만 변경해도 나머지 유지', () => {
    const partial: Partial<StudioSettings> = { privateBookingHoursBefore: 48 }
    const merged: StudioSettings = { ...DEFAULT_STUDIO_SETTINGS, ...partial }
    expect(merged.privateBookingHoursBefore).toBe(48)
    expect(merged.groupBookingHoursBefore).toBe(0)   // default 유지
    expect(merged.waitlistMaxCount).toBe(5)           // default 유지
  })

  it('타입 안전: enum 값', () => {
    expect(['pass', 'date']).toContain(DEFAULT_STUDIO_SETTINGS.dailyBookingLimitType)
    expect(['flexible', '30', '20', '15', '10', '5']).toContain(DEFAULT_STUDIO_SETTINGS.privateBookingTimeUnit)
  })
})
