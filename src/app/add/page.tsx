import { AddForm } from './AddForm'

export const dynamic = 'force-dynamic'

export default function AddPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">거래 입력</h2>
      <p className="text-sm text-neutral-500">결제할 때마다 빠르게 기록하세요. 카테고리는 자동 분류됩니다.</p>
      <AddForm />
    </div>
  )
}
