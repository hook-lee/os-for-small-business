import { fetchAllCategories } from '@/lib/supabase/categories'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { FinancesTabBar } from '@/components/FinancesTabBar'
import { CategoriesManager } from './CategoriesManager'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  let categories: Awaited<ReturnType<typeof fetchAllCategories>> = []
  const ownerId = await requireOwnerId().catch(() => 'no-auth')

  if (hasSupabaseConfig()) {
    try {
      categories = await fetchAllCategories(ownerId)
    } catch {
      // graceful fallback
    }
  }

  return (
    <>
      <FinancesTabBar />
      {categories.length === 0 && !hasSupabaseConfig() && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          Supabase 미설정 — 카테고리 테이블이 없습니다. PENDING-MIGRATIONS.sql + seed-categories.ts 실행 후 사용 가능.
        </div>
      )}
      <CategoriesManager initial={categories} />
    </>
  )
}
