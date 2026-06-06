'use client'

import dynamic from 'next/dynamic'
import type { MonthlyBarChartProps } from './MonthlyBarChart'

/**
 * 차트(recharts ~100KB)를 지연 로딩하는 래퍼.
 *  - ssr:false → 서버 렌더 스킵 + recharts를 별도 청크로 분리해 페이지 첫 페인트가 빨라짐.
 *  - 로딩 중엔 동일 높이의 스켈레톤을 보여 레이아웃 점프(CLS) 방지.
 * 사용처는 기존 import만 이 파일로 바꾸면 됨 (동일한 MonthlyBarChart named export).
 */
const Inner = dynamic(
  () => import('./MonthlyBarChart').then(m => m.MonthlyBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border bg-white p-4">
        <div className="h-64 w-full bg-neutral-50 rounded animate-pulse" />
      </div>
    ),
  },
)

export function MonthlyBarChart(props: MonthlyBarChartProps) {
  return <Inner {...props} />
}

export type { MonthlyDatum, MonthlyBarChartProps } from './MonthlyBarChart'
