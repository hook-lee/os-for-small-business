import { fetchAllPassProducts } from '@/lib/supabase/pass-products'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { PassProductsManager } from './PassProductsManager'
import { MembersTabBar } from '@/components/MembersTabBar'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function PassProductsPage() {
  const ownerId = await requireOwnerId().catch(() => 'no-auth')
  const products = hasSupabaseConfig() ? await fetchAllPassProducts(ownerId) : []
  return (
    <div className="space-y-4">
      <MembersTabBar />
      <PassProductsManager initial={products} />
    </div>
  )
}
