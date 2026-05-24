import { fetchAllPassProducts } from '@/lib/supabase/pass-products'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { PassProductsManager } from './PassProductsManager'
import { MembersTabBar } from '@/components/MembersTabBar'

export const dynamic = 'force-dynamic'

export default async function PassProductsPage() {
  const products = hasSupabaseConfig() ? await fetchAllPassProducts() : []
  return (
    <div className="space-y-4">
      <MembersTabBar />
      <PassProductsManager initial={products} />
    </div>
  )
}
