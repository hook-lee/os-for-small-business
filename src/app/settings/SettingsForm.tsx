'use client'

import { useState, type FormEvent } from 'react'
import type { UserProfile } from '@/lib/profile/settings'

export function SettingsForm({ initial }: { initial: UserProfile }) {
  const [profile, setProfile] = useState<UserProfile>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMsg('')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = (body && typeof body === 'object' && 'error' in body)
          ? String(body.error)
          : `HTTP ${res.status}`
        throw new Error(msg)
      }
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '알 수 없는 오류')
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
      {status === 'error' && (
        <div className="text-red-600 text-sm whitespace-pre-wrap">
          저장 실패: {errorMsg}
        </div>
      )}
    </form>
  )
}
