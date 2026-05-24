export function MemberHeader({ memberName }: { memberName: string }) {
  return (
    <header className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-4 py-5">
      <div className="text-xs opacity-80">라파 필라테스</div>
      <div className="text-lg font-semibold mt-0.5">안녕하세요, {memberName}님</div>
    </header>
  )
}
