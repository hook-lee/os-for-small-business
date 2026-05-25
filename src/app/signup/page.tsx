import { SignupForm } from './SignupForm'
import { redirect } from 'next/navigation'
import { getCurrentUser, hasAuthConfig } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function SignupPage() {
  if (hasAuthConfig()) {
    const user = await getCurrentUser()
    if (user) redirect('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 flex flex-col">
      <header className="px-6 py-5">
        <h1 className="text-2xl font-bold">
          <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">Onmove</span>
          <span className="text-neutral-400 text-sm font-normal ml-2">· 운동 센터 사장님용</span>
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-8">
            <h2 className="text-2xl font-bold text-neutral-900 mb-1">회원가입</h2>
            <p className="text-xs text-neutral-500 mb-6">
              나만의 워크스페이스를 만듭니다. 회원·강사·매출은 본인 계정 안에만 저장됩니다.
            </p>
            <SignupForm />
            <div className="mt-4 text-center text-xs text-neutral-500">
              이미 계정 있으세요? <a href="/login" className="text-violet-600 hover:underline font-medium">로그인</a>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-[11px] text-neutral-400">
        Onmove · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
