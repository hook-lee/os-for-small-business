'use client'

import { useState, useEffect } from 'react'

export type ToastType = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

// 모듈 레벨 store — 컴포넌트 어디서나(훅 없이) toast() 호출 가능.
// toast()를 그대로 대체하기 위한 설계.
let listeners: Array<(items: ToastItem[]) => void> = []
let items: ToastItem[] = []
let seq = 0

function emit() {
  for (const l of listeners) l([...items])
}

/**
 * 화면 하단에 잠깐 떴다 사라지는 알림. toast() 대체.
 *  - 기본 info(중립). 실패/오류엔 type='error', 완료엔 'success'.
 *  - 비블로킹(흐름 안 멈춤) — 호출 직후 다음 코드 계속 진행.
 */
export function toast(message: string, type: ToastType = 'info') {
  const id = ++seq
  items = [...items, { id, message, type }]
  emit()
  setTimeout(() => {
    items = items.filter(i => i.id !== id)
    emit()
  }, 3500)
}

export function ToastContainer() {
  const [list, setList] = useState<ToastItem[]>([])
  useEffect(() => {
    const l = (next: ToastItem[]) => setList(next)
    listeners.push(l)
    return () => { listeners = listeners.filter(x => x !== l) }
  }, [])

  if (list.length === 0) return null
  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center w-full max-w-sm px-4 pointer-events-none">
      {list.map(t => (
        <div
          key={t.id}
          role="status"
          className={`w-full text-sm rounded-lg px-4 py-3 shadow-lg leading-snug break-keep whitespace-pre-line ${
            t.type === 'error'
              ? 'bg-red-600 text-white'
              : t.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-800 text-white'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
