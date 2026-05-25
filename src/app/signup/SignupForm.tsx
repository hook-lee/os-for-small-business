'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseAuthBrowser } from '@/lib/supabase/auth-browser'

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

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
    setSubmitting(true)
    try {
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
      // Supabase 설정: "Confirm email" 옵션 따라 분기
      // - OFF: data.session 즉시 발급 → 바로 로그인됨
      // - ON:  data.session 없음 → 이메일 확인 안내
      if (data.session) {
        router.push('/')
        router.refresh()
      } else {
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
            메일 안의 링크를 클릭한 후 로그인하세요.
          </p>
        </div>
        <a
          href="/login"
          className="block w-full text-center bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
        >
          로그인 페이지로
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">이메일</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">비밀번호 (8자 이상)</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">비밀번호 확인</label>
        <input
          type="password"
          value={passwordConfirm}
          onChange={e => setPasswordConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">⚠ {error}</div>
      )}

      <button
        type="submit"
        disabled={submitting || !email || !password || !passwordConfirm}
        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:from-violet-300 disabled:to-fuchsia-300 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
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
