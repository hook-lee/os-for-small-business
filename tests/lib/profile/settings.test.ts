import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DEFAULT_PROFILE, loadProfile, saveProfile } from '@/lib/profile/settings'

describe('profile settings (Supabase 기반)', () => {
  const originalEnv = { ...process.env }
  beforeEach(() => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('Supabase 미설정 시 loadProfile은 DEFAULT_PROFILE 반환', async () => {
    const p = await loadProfile('test-owner')
    expect(p).toEqual(DEFAULT_PROFILE)
  })

  it('Supabase 미설정 시 saveProfile은 throw', async () => {
    await expect(saveProfile(DEFAULT_PROFILE, 'test-owner')).rejects.toThrow(/Supabase 미설정/)
  })

  it('ownerId="no-auth" 시 loadProfile은 DEFAULT_PROFILE 반환', async () => {
    process.env.SUPABASE_URL = 'http://example.com'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake'
    const p = await loadProfile('no-auth')
    expect(p).toEqual(DEFAULT_PROFILE)
  })

  it('ownerId="no-auth" 시 saveProfile은 throw', async () => {
    process.env.SUPABASE_URL = 'http://example.com'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake'
    await expect(saveProfile(DEFAULT_PROFILE, 'no-auth')).rejects.toThrow(/로그인이 필요/)
  })

  it('DEFAULT_PROFILE 형태 검증', () => {
    expect(DEFAULT_PROFILE.youngStartupReductionRate).toBe(0)
    expect(DEFAULT_PROFILE.isYoungStartupEligible).toBe(false)
    expect(DEFAULT_PROFILE.noranusanAnnualContribution).toBe(0)
    expect(DEFAULT_PROFILE.pensionAnnualContribution).toBe(0)
    expect(DEFAULT_PROFILE.birthDate).toBeNull()
    expect(DEFAULT_PROFILE.businessAddress).toBeNull()
  })
})
