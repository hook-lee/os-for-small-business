export function MemberHeader({ memberName, workspaceName }: { memberName: string; workspaceName?: string | null }) {
  return (
    <header className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-4 py-5">
      <div className="text-xs opacity-80">{workspaceName ?? 'Onmove'}</div>
      <div className="text-lg font-semibold mt-0.5">안녕하세요, {memberName}님</div>
    </header>
  )
}
