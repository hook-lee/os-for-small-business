'use client'

import { useState, useEffect, useRef } from 'react'
import type { NotificationItem } from '@/lib/analytics/notifications'

/**
 * 헤더 종(알림) 아이콘 + 패널. 모바일/데스크탑 공통.
 * 열 때(마운트) /api/notifications 1회 fetch. 설정(ON/OFF) 반영된 활성 알림만 옴.
 */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/notifications')
      .then(r => r.json())
      .then((j: { items?: NotificationItem[] }) => { if (!cancelled) { setItems(j.items ?? []); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const count = items.length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative text-neutral-500 hover:text-neutral-800 leading-none"
        aria-label={`알림${count > 0 ? ` ${count}건` : ''}`}
      >
        <span className="text-xl" aria-hidden>🔔</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 max-w-[85vw] bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50">
          <div className="px-3 py-2 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-sm font-semibold">알림</span>
            <a href="/settings" onClick={() => setOpen(false)} className="text-[11px] text-blue-600 hover:underline">알림 설정</a>
          </div>
          {!loaded ? (
            <div className="px-3 py-4 text-xs text-neutral-400 text-center">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-6 text-xs text-neutral-400 text-center">새 알림이 없어요 👌</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map(it => (
                <a
                  key={it.id}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2.5 hover:bg-neutral-50 border-b border-neutral-50 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                      it.severity === 'urgent' ? 'bg-red-500' : it.severity === 'warn' ? 'bg-amber-500' : 'bg-blue-400'
                    }`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-neutral-800">{it.title}</div>
                      <div className="text-[11px] text-neutral-500 break-keep">{it.detail}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
