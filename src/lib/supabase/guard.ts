import { redirect } from 'next/navigation'
import { getStudioContext, type StudioRole } from './auth-server'

/**
 * 현재 로그인 사용자의 role을 안전하게 반환 (실패 시 owner로 폴백).
 * 네비/레이아웃에서 메뉴 분기용.
 */
export async function getRoleSafe(): Promise<StudioRole> {
  try {
    return (await getStudioContext()).role
  } catch {
    return 'owner'
  }
}

/**
 * 관리자(원장/admin) 전용 페이지 가드.
 * 강사(instructor) 계정이면 /lessons(강사 기본 화면)로 redirect.
 * 재무·세금·설정·급여·강사관리·거래입력 등 민감 페이지의 서버 컴포넌트 최상단에서 await.
 */
export async function guardManagerPage(): Promise<void> {
  const role = await getRoleSafe()
  if (role === 'instructor') redirect('/lessons')
}
