import { NextResponse } from 'next/server'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { fetchActivePassesByMember } from '@/lib/supabase/passes'
import { requireOwnerId } from '@/lib/supabase/auth-server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseConfig()) return NextResponse.json({ passes: [] })
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { id: idRaw } = await params
  const id = parseInt(idRaw, 10)
  if (!Number.isFinite(id)) return NextResponse.json({ passes: [] })
  try {
    const passes = await fetchActivePassesByMember(id, ownerId)
    return NextResponse.json({
      passes: passes.map(p => ({
        id: p.id,
        passName: p.passName,
        remainingCount: p.remainingCount,
        status: p.status,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
