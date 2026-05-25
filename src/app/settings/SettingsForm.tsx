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
        <label className="block text-sm font-medium mb-1">센터명 (워크스페이스) *</label>
        <input
          type="text"
          value={profile.workspaceName ?? ''}
          onChange={e => setProfile({ ...profile, workspaceName: e.target.value || null })}
          placeholder="예: 라파 필라테스, 강남 PT 스튜디오"
          className="border rounded px-2 py-1 w-full"
        />
        <p className="text-xs text-neutral-500 mt-1">상단 헤더에 표시됩니다 (Onmove · 센터명)</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">직급</label>
        <div className="grid grid-cols-4 gap-1.5">
          {['원장', '매니저', '강사', '기타'].map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setProfile({ ...profile, role: r })}
              className={`py-2 text-sm rounded font-medium transition-colors border ${
                profile.role === r
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">센터 전화번호 (선택)</label>
        <input
          type="tel"
          value={profile.businessPhone ?? ''}
          onChange={e => setProfile({ ...profile, businessPhone: e.target.value || null })}
          placeholder="02-1234-5678"
          className="border rounded px-2 py-1 w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">센터 주소 (선택)</label>
        <input
          type="text"
          value={profile.businessAddress ?? ''}
          onChange={e => setProfile({ ...profile, businessAddress: e.target.value || null })}
          placeholder="예: 서울 강남구"
          className="border rounded px-2 py-1 w-full"
        />
      </div>

      <div className="pt-3 border-t border-neutral-200">
        <h3 className="text-sm font-semibold text-neutral-700 mb-2">개인 정보 (세금 시뮬레이터용)</h3>
      </div>

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

      <div>
        <label className="block text-sm font-medium mb-1">사업자 유형</label>
        <div className="flex gap-4 text-sm">
          {(['general', 'simplified'] as const).map(t => (
            <label key={t} className="flex items-center gap-1">
              <input
                type="radio"
                name="taxPayerType"
                checked={profile.taxPayerType === t}
                onChange={() => setProfile({ ...profile, taxPayerType: t })}
              />
              {t === 'general' ? '일반과세자' : '간이과세자'}
            </label>
          ))}
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          {profile.taxPayerType === 'general'
            ? '일반과세자: 부가세 = 매출세액 - 매입세액 공제'
            : '간이과세자: 부가세 ≈ 매출 × 3% (서비스업). 연 매출 4,800만원 미만 시 면제.'}
        </div>
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
