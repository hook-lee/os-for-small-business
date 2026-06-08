import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm',
  secondary: 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50',
  ghost: 'text-neutral-600 hover:bg-neutral-100',
  danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
}

const SIZE: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
}

/**
 * 공통 버튼 — 모든 화면이 이걸 쓰게. (디자인 시스템 v1)
 * variant: primary(브랜드) / secondary(테두리) / ghost(투명) / danger(위험)
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    />
  )
}
