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
          setError('이메일 인증이 아직 안 됐어요. 받은 인증 메일의 링크를 클릭한 뒤 로그인하세요')
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

  const inputCls = 'w-full border border-neutral-300 rounded-lg px-3.5 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition'
  const labelCls = 'block text-sm font-medium text-neutral-700 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>이메일</label>
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
        <label className={labelCls}>비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          ⚠ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !email || !password}
        className="w-full min-h-[52px] bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:from-violet-300 disabled:to-fuchsia-300 text-white font-semibold py-3.5 rounded-xl text-base shadow-sm transition-colors"
      >
        {submitting ? '로그인 중...' : '로그인'}
      </button>

      <p className="text-xs text-neutral-400 text-center pt-3 border-t border-neutral-100">
        처음이신가요? 누구나 무료로 워크스페이스를 만들 수 있어요.
      </p>
    </form>
  )
}
