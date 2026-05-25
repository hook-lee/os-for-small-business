'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseAuthBrowser } from '@/lib/supabase/auth-browser'

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const supabase = getSupabaseAuthBrowser()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        // 실제 에러 메시지를 사용자 친화적으로 변환
        const msg = signInError.message.toLowerCase()
        if (msg.includes('invalid login credentials') || msg.includes('invalid')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다')
        } else if (msg.includes('email not confirmed')) {
          setError('이메일 인증이 완료되지 않은 계정입니다. 운영자에게 문의하세요')
        } else {
          setError(signInError.message)
        }
        return
      }
      // 성공 → 원래 가려던 곳으로
      router.push(next || '/')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
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
          className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1.5">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
          ⚠ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !email || !password}
        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:from-violet-300 disabled:to-fuchsia-300 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
      >
        {submitting ? '로그인 중...' : '로그인'}
      </button>

      <div className="text-[11px] text-neutral-400 text-center pt-2 border-t border-neutral-100">
        계정 발급은 운영자가 직접 합니다.<br />
        가입 신청 X — 외부 사용자 차단을 위해서입니다.
      </div>
    </form>
  )
}
