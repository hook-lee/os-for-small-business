import { guardManagerPage } from '@/lib/supabase/guard'
import { ImportManager } from './ImportManager'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  await guardManagerPage() // 원장/매니저 전용 (강사 차단)
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold">데이터 가져오기 (CSV)</h1>
        <p className="text-sm text-neutral-500 mt-1 break-keep">
          다른 프로그램에서 쓰던 <b>회원·강사·수업·매출/지출</b>을 CSV 파일로 한 번에 옮겨오세요.
          엑셀에서 «다른 이름으로 저장 → CSV»로 만들 수 있어요.
        </p>
      </div>
      <ImportManager />
    </div>
  )
}
