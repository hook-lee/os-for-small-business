import { fetchAllInstructors } from '@/lib/supabase/instructors'
import { hasSupabaseConfig } from '@/lib/supabase/client'
import { InstructorsTable } from './InstructorsTable'

export const dynamic = 'force-dynamic'

export default async function InstructorsPage() {
  const instructors = hasSupabaseConfig() ? await fetchAllInstructors() : []
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">강사 <span className="text-neutral-400 text-sm font-normal">총 {instructors.length}명</span></h2>
      </div>
      {!hasSupabaseConfig() && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
          Supabase 미설정 — 환경변수 설정 후 강사 데이터가 표시됩니다.
        </div>
      )}
      <InstructorsTable instructors={instructors} />
    </div>
  )
}
