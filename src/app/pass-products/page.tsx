import { fetchAllPassProducts } from '@/lib/supabase/pass-products'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function PassProductsPage() {
  const products = hasSupabaseConfig() ? await fetchAllPassProducts() : []
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          수강권 카탈로그{' '}
          <span className="text-neutral-400 text-sm font-normal">총 {products.length}개 상품</span>
        </h2>
      </div>
      {products.length === 0 ? (
        <Card>
          <div className="text-sm text-neutral-500">
            상품이 아직 없습니다. (Supabase 마이그레이션 + seed 필요)
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {products.map(p => (
            <Card
              key={p.id}
              className="space-y-2"
              style={p.color ? { borderTop: `4px solid ${p.color}` } : undefined}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-base">{p.name}</div>
                  <div className="text-xs text-neutral-500">
                    {p.passType} · {p.durationDays}일 · {p.totalCount}회
                  </div>
                </div>
              </div>
              <div className="text-xl font-bold tabular-nums">{p.price.toLocaleString()}원</div>
              {p.perUnitPrice && (
                <div className="text-xs text-neutral-500">
                  회당 {p.perUnitPrice.toLocaleString()}원
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
