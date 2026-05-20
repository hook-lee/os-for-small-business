import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { DEFAULT_PROFILE, loadProfile, saveProfile } from '@/lib/profile/settings'

describe('profile settings', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('파일 없으면 DEFAULT_PROFILE 반환', async () => {
    vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('ENOENT'))
    const p = await loadProfile()
    expect(p).toEqual(DEFAULT_PROFILE)
  })

  it('파일 있으면 디폴트와 merge', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({ noranusanAnnualContribution: 1_000_000 }) as never)
    const p = await loadProfile()
    expect(p.noranusanAnnualContribution).toBe(1_000_000)
    expect(p.birthDate).toBeNull()  // default
    expect(p.isYoungStartupEligible).toBe(false)  // default
  })

  it('saveProfile은 디렉토리 생성 + JSON 쓰기', async () => {
    const mkdir = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined)
    const writeFile = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined)
    const profile = { ...DEFAULT_PROFILE, businessAddress: '서울 강남구' }
    await saveProfile(profile)
    expect(mkdir).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalled()
    const writeArgs = writeFile.mock.calls[0]
    expect(JSON.parse(writeArgs[1] as string).businessAddress).toBe('서울 강남구')
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
