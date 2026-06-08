import { fetchAllPassProducts } from '@/lib/supabase/pass-products'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { PassProductsManager } from './PassProductsManager'
import { LessonsTabs } from '@/app/lessons/LessonsTabs'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function PassProductsPage() {
  await import('@/lib/supabase/guard').then(m => m.guardManagerPage())
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  const products = hasSupabaseConfig() ? await fetchAllPassProducts(ownerId) : []
  return (
    <div className="space-y-4">
      <LessonsTabs current="products" />
      <PassProductsManager initial={products} />
    </div>
  )
}
