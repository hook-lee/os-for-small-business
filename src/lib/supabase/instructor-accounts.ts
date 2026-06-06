import { getSupabaseClient } from './client'
import { randomBytes } from 'crypto'

/**
 * 강사 로그인 계정 발급 (원장이 강사 대신 생성).
 *  - service_role의 auth.admin.createUser로 강사 계정 생성(이메일 확인 생략).
 *  - instructors.auth_user_id 에 연결 → 강사 로그인 시 getStudioContext가 소속·권한 판별.
 *  - 임시 비밀번호를 반환 → 원장이 강사에게 전달(앱은 이메일 발송 안 함).
 * 멀티테넌트: 해당 강사가 내 스튜디오(ownerId) 소속인지 확인.
 */

function genPassword(): string {
  const base = randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '')
  return (base.slice(0, 10) || 'Onmove') + 'A1!'
}

export async function createInstructorLoginAccount(
  instructorId: number,
  email: string,
  ownerId: string,
): Promise<{ email: string; tempPassword: string }> {
  const supabase = getSupabaseClient()

  let q = supabase.from('instructors').select('id, auth_user_id').eq('id', instructorId)
  if (ownerId !== 'no-auth') q = q.eq('owner_id', ownerId)
  const { data, error } = await q.maybeSingle()
  if (error || !data) throw new Error('강사를 찾을 수 없습니다')
  const inst = data as { id: number; auth_user_id: string | null }
  if (inst.auth_user_id) throw new Error('이미 로그인 계정이 연결돼 있습니다')

  const tempPassword = genPassword()
  const { data: created, error: cErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })
  if (cErr || !created?.user) {
    throw new Error(`계정 생성 실패: ${cErr?.message ?? '이미 가입된 이메일일 수 있어요'}`)
  }

  let uq = supabase.from('instructors').update({ auth_user_id: created.user.id, email }).eq('id', instructorId)
  if (ownerId !== 'no-auth') uq = uq.eq('owner_id', ownerId)
  const { error: uErr } = await uq
  if (uErr) {
    // 연결 실패 → 방금 만든 계정 롤백 (orphan 방지)
    try { await supabase.auth.admin.deleteUser(created.user.id) } catch { /* noop */ }
    throw new Error(`연결 실패: ${uErr.message}`)
  }

  return { email, tempPassword }
}
