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
      className={`rounded-lg border border-neutral-200 bg-white p-4 shadow-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
