import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white shadow-sm',
  secondary: 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400',
  ghost: 'text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200',
  danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:bg-red-200',
}

// 터치 친화 최소 높이(모바일 44px 권장)·또렷한 폰트·여유 패딩.
const SIZE: Record<Size, string> = {
  sm: 'min-h-[38px] text-sm px-3.5 py-1.5 gap-1.5',
  md: 'min-h-[44px] text-sm px-5 py-2.5 gap-2',
  lg: 'min-h-[52px] text-base px-6 py-3 gap-2',
}

/**
 * 공통 버튼 — 모든 화면이 이걸 쓰게. (디자인 시스템 v2)
 * - variant: primary(브랜드) / secondary(테두리) / ghost(투명) / danger(위험)
 * - size: sm / md / lg — 전부 손가락 터치에 충분한 높이
 * - fullWidth: 폼 제출 등 한 줄 꽉 채우는 버튼용
 * 포커스 가시성은 globals.css의 focus-visible outline이 일괄 처리.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; fullWidth?: boolean }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium leading-none whitespace-nowrap select-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    />
  )
}
