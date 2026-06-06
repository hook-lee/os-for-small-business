/**
 * 전역 로딩 스켈레톤.
 * force-dynamic 페이지가 서버에서 데이터를 받는 동안, 헤더·탭바는 유지된 채
 * 본문 자리에 이 스켈레톤이 즉시 떠서 "멈춘 듯" 보이는 체감을 없앤다.
 * (Next.js: 해당 세그먼트와 하위 라우트 전환 시 page fallback으로 사용)
 */
export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="불러오는 중">
      <div className="h-7 w-44 bg-neutral-200 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-neutral-100 rounded-lg border border-neutral-200" />
        ))}
      </div>
      <div className="h-72 bg-neutral-100 rounded-lg border border-neutral-200" />
    </div>
  )
}
