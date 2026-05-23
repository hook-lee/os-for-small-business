import { NextResponse } from 'next/server'
import { fetchAllPassProducts } from '@/lib/supabase/pass-products'
import { hasSupabaseConfig } from '@/lib/supabase/client'

export async function GET() {
  if (!hasSupabaseConfig()) return NextResponse.json({ products: [] })
  try {
    const products = await fetchAllPassProducts()
    return NextResponse.json({ products })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
