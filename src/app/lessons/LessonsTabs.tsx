export function LessonsTabs({ current }: { current: 'individual' | 'groups' }) {
  return (
    <div className="flex gap-1 border-b border-neutral-200 mb-4">
      <a href="/lessons" className={`px-4 py-2 text-sm font-medium border-b-2 ${current === 'individual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>개별 수업</a>
      <a href="/lessons/groups" className={`px-4 py-2 text-sm font-medium border-b-2 ${current === 'groups' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>그룹 수업</a>
    </div>
  )
}
