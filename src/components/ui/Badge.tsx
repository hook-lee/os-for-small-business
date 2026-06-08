import type { ReactNode } from 'react'

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'brand'

const TONE: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-600',
  success: 'bg-emerald-100 text-emerald-700',
  warn: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  brand: 'bg-violet-100 text-violet-700',
}

/** 상태 라벨 pill. 디자인 시스템 v1. */
export function Badge({ tone = 'neutral', className = '', children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${TONE[tone]} ${className}`}>
      {children}
    </span>
  )
}
