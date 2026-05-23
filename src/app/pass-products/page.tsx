import { fetchAllPassProducts } from '@/lib/supabase/pass-products'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { PassProductsManager } from './PassProductsManager'

export const dynamic = 'force-dynamic'

export default async function PassProductsPage() {
  const products = hasSupabaseConfig() ? await fetchAllPassProducts() : []
  return (
    <div className="space-y-4">
      <PassProductsManager initial={products} />
    </div>
  )
}
