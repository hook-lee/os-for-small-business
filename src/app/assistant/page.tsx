import { AssistantChat } from './AssistantChat'

export const dynamic = 'force-dynamic'

export default function AssistantPage() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold">💬 AI 비서</h2>
        <p className="text-sm text-neutral-500">
          회원·강사·매출·지출·세금에 대해 자유롭게 물어보세요. 실제 DB를 조회해서 답합니다.
        </p>
      </div>
      <AssistantChat />
    </div>
  )
}
