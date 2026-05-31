import { fetchConsultationsByMember } from '@/lib/supabase/consultations'

/**
 * 회원 상세 페이지의 '상담 이력' 섹션. Server component.
 */
export async function MemberConsultations({ memberId, ownerId }: { memberId: number; ownerId: string }) {
  let consultations: Awaited<ReturnType<typeof fetchConsultationsByMember>> = []
  try {
    consultations = await fetchConsultationsByMember(memberId, ownerId)
  } catch { /* 무시 */ }

  if (consultations.length === 0) return null

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">상담 이력 ({consultations.length}건)</h3>
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
            <tr>
              <th className="text-left px-3 py-2 w-28 whitespace-nowrap">일자</th>
              <th className="text-left px-3 py-2 w-24 whitespace-nowrap">인입경로</th>
              <th className="text-left px-3 py-2">내용</th>
              <th className="text-left px-3 py-2 w-24 whitespace-nowrap">담당</th>
            </tr>
          </thead>
          <tbody>
            {consultations.map(c => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 tabular-nums text-neutral-700 whitespace-nowrap">{c.consultationDate}</td>
                <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{c.inflowChannel ?? '—'}</td>
                <td className="px-3 py-2 text-neutral-700">{c.content ?? <span className="text-neutral-400">—</span>}</td>
                <td className="px-3 py-2 text-neutral-600 whitespace-nowrap">{c.staffName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
