'use client'

import { useState, useEffect } from 'react'
import { Icon } from './ui/Icon'

/** 다크/라이트 테마 토글. html.dark 클래스 + localStorage('theme'). */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [dark, setDark] = useState(false)
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')) }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch { /* 무시 */ }
  }

  return (
    <button
      onClick={toggle}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-neutral-500 hover:bg-neutral-100"
      title={dark ? '라이트 모드로' : '다크 모드로'}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} className="shrink-0" />
      {!collapsed && <span>{dark ? '라이트 모드' : '다크 모드'}</span>}
    </button>
  )
}
