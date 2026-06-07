import { NextResponse } from 'next/server'
import { fetchMemberByToken } from '@/lib/supabase/members'
import { fetchContractsByMember, agreeContract } from '@/lib/supabase/contracts'

// 회원이 토큰 링크로 계약서에 동의 (auth 우회 — 토큰이 자격증명)
export async function POST(req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await ctx.params
  const contractId = Number(id)
  if (!Number.isFinite(contractId)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const member = await fetchMemberByToken(token)
  if (!member) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const ownerId = member.ownerId ?? 'no-auth'

  // 이 계약이 이 회원 것인지 확인 (남의 계약 동의 방지)
  const mine = (await fetchContractsByMember(member.id, ownerId)).find(c => c.id === contractId)
  if (!mine) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (mine.status === 'agreed') return NextResponse.json({ ok: true, alreadyAgreed: true })

  try {
    const body = await req.json() as { name?: string; signatureData?: string | null }
    if (!body.name?.trim()) return NextResponse.json({ error: '성명을 입력해주세요' }, { status: 400 })
    await agreeContract(contractId, ownerId, body.name.trim(), body.signatureData ?? null)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
