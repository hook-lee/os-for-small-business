import { NextResponse } from 'next/server'
import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { hasSupabaseConfig } from '@/lib/supabase/client'

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ instructors: [] })
  }
  try {
    const instructors = await fetchAllInstructors()
    return NextResponse.json({ instructors })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
