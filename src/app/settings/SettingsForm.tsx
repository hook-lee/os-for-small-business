'use client'

import { useState, type FormEvent } from 'react'
import type { UserProfile } from '@/lib/profile/settings'

export function SettingsForm({ initial }: { initial: UserProfile }) {
  const [profile, setProfile] = useState<UserProfile>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!res.ok) throw new Error('save failed')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-1">생년월일</label>
        <input
          type="date"
          value={profile.birthDate ?? ''}
          onChange={e => setProfile({ ...profile, birthDate: e.target.value || null })}
          className="border rounded px-2 py-1 w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">사업장 주소 (시·구)</label>
        <input
          type="text"
          value={profile.businessAddress ?? ''}
          onChange={e => setProfile({ ...profile, businessAddress: e.target.value || null })}
          placeholder="예: 서울 강남구"
          className="border rounded px-2 py-1 w-full"
        />
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={profile.isYoungStartupEligible}
            onChange={e => setProfile({ ...profile, isYoungStartupEligible: e.target.checked })}
          />
          <span className="text-sm font-medium">청년창업감면 대상 (만 34세 이하 + 필라테스업 + 2024 창업)</span>
        </label>
      </div>

      {profile.isYoungStartupEligible && (
        <div>
          <label className="block text-sm font-medium mb-1">감면율</label>
          <div className="flex gap-3 text-sm">
            {[0, 0.5, 1.0].map(rate => (
              <label key={rate} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="rate"
                  checked={profile.youngStartupReductionRate === rate}
                  onChange={() => setProfile({ ...profile, youngStartupReductionRate: rate as 0 | 0.5 | 1.0 })}
                />
                {rate === 1.0 ? '100% (수도권 외)' : rate === 0.5 ? '50% (수도권 과밀억제권역)' : '0%'}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">노란우산공제 연 납입액 (원)</label>
        <input
          type="number"
          min="0"
          value={profile.noranusanAnnualContribution}
          onChange={e => setProfile({ ...profile, noranusanAnnualContribution: Number(e.target.value) })}
          className="border rounded px-2 py-1 w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">연금저축 연 납입액 (원)</label>
        <input
          type="number"
          min="0"
          value={profile.pensionAnnualContribution}
          onChange={e => setProfile({ ...profile, pensionAnnualContribution: Number(e.target.value) })}
          className="border rounded px-2 py-1 w-full"
        />
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        disabled={status === 'saving'}
      >
        {status === 'saving' ? '저장 중...' : status === 'saved' ? '저장됨' : '저장'}
      </button>
      {status === 'error' && <div className="text-red-600 text-sm">저장 실패</div>}
    </form>
  )
}
