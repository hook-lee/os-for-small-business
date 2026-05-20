import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiCard } from '@/components/ui/KpiCard'

describe('KpiCard', () => {
  it('타이틀과 금액 표시', () => {
    render(<KpiCard title="매출" amount={11_494_500} />)
    expect(screen.getByText('매출')).toBeInTheDocument()
    expect(screen.getByText('11,494,500')).toBeInTheDocument()
  })

  it('subtitle 옵션 표시', () => {
    render(<KpiCard title="매출" amount={1_000_000} subtitle="2026년 2월" />)
    expect(screen.getByText('2026년 2월')).toBeInTheDocument()
  })

  it('음수는 빨간색', () => {
    const { container } = render(<KpiCard title="지출" amount={-500_000} />)
    expect(container.querySelector('.text-red-600')).toBeTruthy()
  })
})
