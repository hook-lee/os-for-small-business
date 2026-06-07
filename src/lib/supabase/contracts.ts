import { getSupabaseClient } from './client'
import {
  CONTRACT_KINDS, CONTRACT_DEFAULTS, type ContractKind,
} from '@/lib/contracts/defaults'

/**
 * 전자계약 템플릿 + 인스턴스 DB 처리. 멀티테넌트 owner_id 격리.
 *  - 템플릿: 원장이 편집한 분만 DB 저장. 안 한 종류는 코드 기본 샘플 사용.
 *  - 계약 인스턴스(발송/동의)는 Phase 2.
 */

export interface ResolvedTemplate {
  kind: ContractKind
  title: string
  body: string
  isDefault: boolean   // true = 코드 기본 샘플(원장 미편집)
}

/** 4종 템플릿 — 저장분 우선, 없으면 기본 샘플. (테이블 미존재 시 전부 기본) */
export async function loadContractTemplates(ownerId: string): Promise<ResolvedTemplate[]> {
  const supabase = getSupabaseClient()
  const saved = new Map<string, { title: string; body: string }>()
  try {
    let q = supabase.from('contract_templates').select('kind, title, body')
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data } = await q
    for (const r of (data ?? []) as Array<{ kind: string; title: string; body: string }>) {
      saved.set(r.kind, { title: r.title, body: r.body })
    }
  } catch {
    /* 테이블 미존재(마이그 전) → 기본만 */
  }
  return CONTRACT_KINDS.map(kind => {
    const s = saved.get(kind)
    return s
      ? { kind, title: s.title, body: s.body, isDefault: false }
      : { kind, title: CONTRACT_DEFAULTS[kind].title, body: CONTRACT_DEFAULTS[kind].body, isDefault: true }
  })
}

export async function saveContractTemplate(
  ownerId: string, kind: ContractKind, title: string, body: string,
): Promise<void> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = { kind, title, body, updated_at: new Date().toISOString() }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { error } = await supabase
    .from('contract_templates')
    .upsert(row, { onConflict: 'owner_id,kind' })
  if (error) throw new Error(`계약서 템플릿 저장 실패: ${error.message}`)
}

// ── 계약 인스턴스(발송/동의) ─────────────────────────────

export interface Contract {
  id: number
  kind: string
  targetType: 'member' | 'instructor'
  memberId: number | null
  instructorId: number | null
  title: string
  body: string
  status: 'sent' | 'agreed' | 'void'
  agreedName: string | null
  agreedAt: string | null
  signatureData: string | null
  createdAt: string
}

interface ContractRow {
  id: number
  kind: string
  target_type: 'member' | 'instructor'
  member_id: number | null
  instructor_id: number | null
  title: string
  body: string
  status: 'sent' | 'agreed' | 'void'
  agreed_name: string | null
  agreed_at: string | null
  signature_data: string | null
  created_at: string
}

function rowToContract(r: ContractRow): Contract {
  return {
    id: r.id, kind: r.kind, targetType: r.target_type,
    memberId: r.member_id, instructorId: r.instructor_id,
    title: r.title, body: r.body, status: r.status,
    agreedName: r.agreed_name, agreedAt: r.agreed_at,
    signatureData: r.signature_data, createdAt: r.created_at,
  }
}

export interface NewContract {
  kind: string
  targetType: 'member' | 'instructor'
  memberId?: number | null
  instructorId?: number | null
  title: string
  body: string   // 변수 치환 완료된 스냅샷
}

export async function createContract(input: NewContract, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {
    kind: input.kind,
    target_type: input.targetType,
    member_id: input.memberId ?? null,
    instructor_id: input.instructorId ?? null,
    title: input.title,
    body: input.body,
    status: 'sent',
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase.from('contracts').insert(row).select('id').single()
  if (error) throw new Error(`계약서 발송 실패: ${error.message}`)
  return (data as { id: number }).id
}

async function fetchContractsBy(col: 'member_id' | 'instructor_id', id: number, ownerId: string): Promise<Contract[]> {
  const supabase = getSupabaseClient()
  try {
    let q = supabase.from('contracts').select('*').eq(col, id).order('created_at', { ascending: false })
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error || !data) return []
    return (data as ContractRow[]).map(rowToContract)
  } catch {
    return []
  }
}

export const fetchContractsByMember = (memberId: number, ownerId: string) => fetchContractsBy('member_id', memberId, ownerId)
export const fetchContractsByInstructor = (instructorId: number, ownerId: string) => fetchContractsBy('instructor_id', instructorId, ownerId)

/** 동의 처리: 이름 + 손글씨 서명(base64) + 시각 기록. 이미 동의된 건 무시. */
export async function agreeContract(contractId: number, ownerId: string, name: string, signatureData: string | null): Promise<void> {
  const supabase = getSupabaseClient()
  const patch: Record<string, unknown> = {
    status: 'agreed',
    agreed_name: name,
    agreed_at: new Date().toISOString(),
    signature_data: signatureData,
  }
  let q = supabase.from('contracts').update(patch).eq('id', contractId).neq('status', 'agreed')
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`동의 처리 실패: ${error.message}`)
}
