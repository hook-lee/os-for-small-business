import { NextResponse } from 'next/server'
import { fetchAllMembers } from '@/lib/supabase/members'
import { hasSupabaseConfig } from '@/lib/supabase/client'

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ members: [] })
  }
  try {
    const members = await fetchAllMembers()
    return NextResponse.json({ members })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
