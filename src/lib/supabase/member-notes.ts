import { getSupabaseClient } from './client'

/**
 * 회원 운동 일지 (member_notes).
 *  - 회원별 날짜순 누적 기록(운동 내용·특이사항·목표·등록시문제·개선).
 *  - author_instructor_id: 작성/담당 강사. lesson_id: (선택) 연결된 개인수업.
 * 멀티테넌트: owner_id 격리.
 */

export const MEMBER_NOTE_TAGS = ['운동기록', '특이사항', '목표', '등록시문제', '개선'] as const
export type MemberNoteTag = (typeof MEMBER_NOTE_TAGS)[number]

export interface MemberNote {
  id: number
  memberId: number
  noteDate: string            // yyyy-mm-dd
  content: string
  tags: string[]
  authorInstructorId: number | null
  authorName?: string | null  // join으로 채움 (instructors.name)
  lessonId: number | null
  createdAt: string
}

interface MemberNoteRow {
  id: number
  member_id: number
  note_date: string
  content: string
  tags: string[] | null
  author_instructor_id: number | null
  lesson_id: number | null
  created_at: string
}

function rowToNote(row: MemberNoteRow, authorName?: string | null): MemberNote {
  return {
    id: row.id,
    memberId: row.member_id,
    noteDate: row.note_date,
    content: row.content,
    tags: Array.isArray(row.tags) ? row.tags : [],
    authorInstructorId: row.author_instructor_id,
    authorName: authorName ?? null,
    lessonId: row.lesson_id,
    createdAt: row.created_at,
  }
}

/**
 * 한 회원의 운동 일지 (최신 날짜순). 작성 강사 이름까지 join.
 * 테이블 미존재(마이그 전)면 빈 배열 반환 (graceful).
 */
export async function fetchNotesByMember(memberId: number, ownerId: string): Promise<MemberNote[]> {
  const supabase = getSupabaseClient()
  try {
    let q = supabase
      .from('member_notes')
      .select('*')
      .eq('member_id', memberId)
      .order('note_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
    const { data, error } = await q
    if (error || !data) return []
    const rows = data as MemberNoteRow[]

    // 작성 강사 이름 매핑
    const instructorIds = [...new Set(rows.map(r => r.author_instructor_id).filter((x): x is number => x != null))]
    const nameById = new Map<number, string>()
    if (instructorIds.length > 0) {
      let iq = supabase.from('instructors').select('id, name').in('id', instructorIds)
      if (ownerId !== 'no-auth') iq = iq.eq('owner_id', ownerId)
      const { data: insts } = await iq
      for (const i of (insts ?? []) as Array<{ id: number; name: string }>) nameById.set(i.id, i.name)
    }
    return rows.map(r => rowToNote(r, r.author_instructor_id != null ? nameById.get(r.author_instructor_id) : null))
  } catch {
    return []
  }
}

export interface NewMemberNote {
  memberId: number
  noteDate: string
  content: string
  tags: string[]
  authorInstructorId?: number | null
  lessonId?: number | null
}

export async function createMemberNote(input: NewMemberNote, ownerId: string): Promise<number> {
  const supabase = getSupabaseClient()
  const row: Record<string, unknown> = {
    member_id: input.memberId,
    note_date: input.noteDate,
    content: input.content,
    tags: input.tags ?? [],
    author_instructor_id: input.authorInstructorId ?? null,
    lesson_id: input.lessonId ?? null,
  }
  if (ownerId !== 'no-auth') row.owner_id = ownerId
  const { data, error } = await supabase.from('member_notes').insert(row).select('id').single()
  if (error) throw new Error(`Create member note failed: ${error.message}`)
  return (data as { id: number }).id
}

export interface MemberNotePatch {
  noteDate?: string
  content?: string
  tags?: string[]
  authorInstructorId?: number | null
}

export async function updateMemberNote(id: number, patch: MemberNotePatch, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.noteDate !== undefined) dbPatch.note_date = patch.noteDate
  if (patch.content !== undefined) dbPatch.content = patch.content
  if (patch.tags !== undefined) dbPatch.tags = patch.tags
  if (patch.authorInstructorId !== undefined) dbPatch.author_instructor_id = patch.authorInstructorId
  let q = supabase.from('member_notes').update(dbPatch).eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Update member note failed: ${error.message}`)
}

export async function deleteMemberNote(id: number, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient()
  let q = supabase.from('member_notes').delete().eq('id', id)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { error } = await q
  if (error) throw new Error(`Delete member note failed: ${error.message}`)
}
