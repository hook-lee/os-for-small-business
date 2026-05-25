'use client'

import { useState, useRef, useEffect } from 'react'
import { getSupabaseAuthBrowser } from '@/lib/supabase/auth-browser'
import { useRouter } from 'next/navigation'

export function UserMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      const supabase = getSupabaseAuthBrowser()
      await supabase.auth.signOut()
    } catch {
      // 무시
    }
    router.push('/login')
    router.refresh()
  }

  if (!email) return null

  // 이메일 첫 글자 아바타
  const initial = email.charAt(0).toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"
        aria-label="사용자 메뉴"
      >
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-xs font-bold flex items-center justify-center">
          {initial}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50">
          <div className="px-3 py-2 border-b border-neutral-100">
            <div className="text-[10px] text-neutral-400 uppercase tracking-wider">로그인됨</div>
            <div className="text-xs text-neutral-800 font-medium truncate">{email}</div>
          </div>
          <a
            href="/settings"
            className="block px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
            onClick={() => setOpen(false)}
          >
            ⚙️ 설정
          </a>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {signingOut ? '로그아웃 중...' : '🚪 로그아웃'}
          </button>
        </div>
      )}
    </div>
  )
}
