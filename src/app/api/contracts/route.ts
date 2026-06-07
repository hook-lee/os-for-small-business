import { NextResponse } from 'next/server'
import { requireOwnerId, getStudioContext } from '@/lib/supabase/auth-server'
import { loadContractTemplates, createContract } from '@/lib/supabase/contracts'
import { renderContract, CONTRACT_TARGET, isContractKind } from '@/lib/contracts/defaults'
import { fetchMemberById } from '@/lib/supabase/members'
import { fetchInstructorById } from '@/lib/supabase/instructors'
import { loadProfile } from '@/lib/profile/settings'

export async function POST(req: Request) {
  let ownerId: string
  try { ownerId = await requireOwnerId() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  // 발송은 원장/관리자만
  try {
    const studio = await getStudioContext()
    if (studio.role === 'instructor') return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json() as { kind?: string; memberId?: number; instructorId?: number }
    if (!body.kind || !isContractKind(body.kind)) {
      return NextResponse.json({ error: '계약 종류가 올바르지 않습니다' }, { status: 400 })
    }
    const targetType = CONTRACT_TARGET[body.kind]
    if (targetType === 'member' && !body.memberId) return NextResponse.json({ error: 'memberId 필수' }, { status: 400 })
    if (targetType === 'instructor' && !body.instructorId) return NextResponse.json({ error: 'instructorId 필수' }, { status: 400 })

    const [templates, profile] = await Promise.all([
      loadContractTemplates(ownerId),
      loadProfile(ownerId).catch(() => null),
    ])
    const tpl = templates.find(t => t.kind === body.kind)
    if (!tpl) return NextResponse.json({ error: '템플릿을 찾을 수 없습니다' }, { status: 404 })

    let memberName = ''
    let instructorName = ''
    if (targetType === 'member') {
      const m = await fetchMemberById(body.memberId!, ownerId)
      if (!m) return NextResponse.json({ error: '회원을 찾을 수 없습니다' }, { status: 404 })
      memberName = m.name
    } else {
      const i = await fetchInstructorById(body.instructorId!, ownerId)
      if (!i) return NextResponse.json({ error: '강사를 찾을 수 없습니다' }, { status: 404 })
      instructorName = i.name
    }

    const today = new Date().toISOString().slice(0, 10)
    const vars: Record<string, string> = {
      센터명: profile?.workspaceName ?? '○○ 센터',
      회원명: memberName,
      강사명: instructorName,
      날짜: today,
    }
    const id = await createContract({
      kind: body.kind,
      targetType,
      memberId: targetType === 'member' ? body.memberId : null,
      instructorId: targetType === 'instructor' ? body.instructorId : null,
      title: renderContract(tpl.title, vars),
      body: renderContract(tpl.body, vars),
    }, ownerId)

    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
