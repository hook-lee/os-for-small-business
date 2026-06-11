'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseAuthBrowser } from '@/lib/supabase/auth-browser'

const ROLES = ['원장', '매니저', '강사', '기타'] as const
type Role = typeof ROLES[number]

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  // 필수
  const [workspaceName, setWorkspaceName] = useState('')
  const [role, setRole] = useState<Role>('원장')
  // 선택
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

  // 폼 공통 스타일 — 여유 패딩·또렷한 글자·일관된 포커스. (모바일 16px는 globals.css가 보강)
  const inputCls = 'w-full border border-neutral-300 rounded-lg px-3.5 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition'
  const labelCls = 'block text-sm font-medium text-neutral-700 mb-1.5'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다')
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }
    if (!workspaceName.trim()) {
      setError('센터명을 입력하세요')
      return
    }
    setSubmitting(true)
    try {
      // Rate limit pre-check (IP 기반 abuse 방지)
      const rlRes = await fetch('/api/auth/signup-check', { method: 'POST' })
      if (rlRes.status === 429) {
        const rlJson = await rlRes.json() as { error?: string }
        setError(rlJson.error ?? '잠시 후 다시 시도해주세요')
        setSubmitting(false)
        return
      }
      const supabase = getSupabaseAuthBrowser()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (signUpError) {
        const msg = signUpError.message.toLowerCase()
        if (msg.includes('already registered') || msg.includes('already')) {
          setError('이미 가입된 이메일입니다. 로그인을 시도하세요.')
        } else {
          setError(signUpError.message)
        }
        return
      }
      // Confirm Email 옵션에 따라 분기
      if (data.session) {
        // 자동 로그인됨 → profile 즉시 저장
        try {
          await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspaceName: workspaceName.trim(),
              role,
              businessPhone: businessPhone.trim() || null,
              businessAddress: businessAddress.trim() || null,
              // 나머지는 기본값으로 채움
              birthDate: null,
              isYoungStartupEligible: false,
              youngStartupReductionRate: 0,
              noranusanAnnualContribution: 0,
              pensionAnnualContribution: 0,
              personalDeductionCount: 1,
              taxPayerType: 'simplified',
              taxStartMonth: new Date().toISOString().slice(0, 7),
              taxGeneralSinceMonth: null,
            }),
          })
        } catch { /* profile 저장 실패는 치명적이지 않음 — 설정 페이지에서 다시 입력 가능 */ }
        router.push('/')
        router.refresh()
      } else {
        // 이메일 확인 필요 — sessionStorage에 임시 저장 후 첫 로그인 때 적용
        try {
          sessionStorage.setItem('pending_profile', JSON.stringify({
            workspaceName: workspaceName.trim(),
            role,
            businessPhone: businessPhone.trim() || null,
            businessAddress: businessAddress.trim() || null,
          }))
        } catch { /* localStorage 차단 환경 무시 */ }
        setNeedsEmailConfirm(true)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (needsEmailConfirm) {
    return (
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
          <div className="font-bold mb-1">✉️ 이메일을 확인해주세요</div>
          <p className="text-xs">
            {email}로 인증 메일을 보냈습니다.<br />
            메일의 링크를 클릭한 후 로그인하세요.
          </p>
        </div>
        <a
          href="/login"
          className="flex items-center justify-center w-full min-h-[48px] bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl text-base shadow-sm transition-colors"
        >
          로그인 페이지로
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ── 필수 정보 ── */}
      <div className="space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-violet-600">필수 정보</div>

        <div>
          <label className={labelCls}>이메일 *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>비밀번호 * (8자 이상)</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>비밀번호 확인 *</label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={e => setPasswordConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>센터명 *</label>
          <input
            type="text"
            value={workspaceName}
            onChange={e => setWorkspaceName(e.target.value)}
            required
            placeholder="예: 라파 필라테스, 강남 PT 스튜디오"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>직급 *</label>
          <div className="grid grid-cols-4 gap-2">
            {ROLES.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`min-h-[44px] text-sm rounded-lg font-medium transition-colors border ${
                  role === r
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 선택 정보 ── */}
      <div className="space-y-3 pt-2 border-t border-neutral-100">
        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">선택 정보 (나중에 설정 가능)</div>

        <div>
          <label className={labelCls}>센터 전화번호</label>
          <input
            type="tel"
            value={businessPhone}
            onChange={e => setBusinessPhone(e.target.value)}
            placeholder="02-1234-5678"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>센터 주소</label>
          <input
            type="text"
            value={businessAddress}
            onChange={e => setBusinessAddress(e.target.value)}
            placeholder="예: 서울 강남구 역삼동"
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">⚠ {error}</div>
      )}

      <button
        type="submit"
        disabled={submitting || !email || !password || !passwordConfirm || !workspaceName.trim()}
        className="w-full min-h-[52px] bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:from-violet-300 disabled:to-fuchsia-300 text-white font-semibold py-3.5 rounded-xl text-base shadow-sm transition-colors"
      >
        {submitting ? '계정 생성 중...' : '계정 만들기'}
      </button>

      <p className="text-[10px] text-neutral-400 text-center">
        가입 즉시 빈 워크스페이스가 생성됩니다.<br />
        본인 회원·강사·매출 데이터를 직접 입력해 시작하세요.
      </p>
    </form>
  )
}
