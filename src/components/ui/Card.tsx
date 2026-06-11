import type { ReactNode, CSSProperties } from 'react'

export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
