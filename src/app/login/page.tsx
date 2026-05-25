import { LoginForm } from './LoginForm'
import { redirect } from 'next/navigation'
import { getCurrentUser, hasAuthConfig } from '@/lib/supabase/auth-server'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams
  const nextPath = sp?.next ?? '/'

  // 이미 로그인된 사용자는 대시보드로
  if (hasAuthConfig()) {
    const user = await getCurrentUser()
    if (user) redirect(nextPath || '/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 flex flex-col">
      {/* 상단 브랜드 */}
      <header className="px-6 py-5">
        <h1 className="text-2xl font-bold">
          <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">Onmove</span>
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* 좌측: 마케팅 / 기능 소개 */}
          <div className="space-y-6">
            <div>
              <div className="inline-block text-[11px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full mb-3">
                운동 센터 사장님용
              </div>
              <h2 className="text-3xl font-bold text-neutral-900 leading-tight">
                회원·강사·매출·세금<br />
                <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                  한 곳에서 굴린다
                </span>
              </h2>
              <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                일반 회원 관리 SaaS가 못 하는 <strong>세금 시뮬레이션</strong>까지.
                결제 한 줄 입력하면 부가세·종소세·예비비가 자동으로 굴러갑니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {[
                { icon: '👥', label: '회원·강사 통합 관리', desc: '수강권 발급 · 시급 4종 · 노쇼 자동 차감' },
                { icon: '💰', label: '매출·지출 가계부', desc: '거래 한 줄 → 카테고리 자동 + 부가세 계산' },
                { icon: '📊', label: '세금 시뮬레이터', desc: '부가세(일반/간이) · 종소세 · 청년창업감면' },
                { icon: '🏦', label: '권장 예비비 추천', desc: '월별 세금 적립 가이드' },
                { icon: '💬', label: 'AI 비서 (Gemini)', desc: '데이터 들고 상담 — "이번 달 광고비 어디 썼어?"' },
              ].map(f => (
                <div key={f.label} className="flex items-start gap-3 bg-white border border-neutral-200 rounded-lg p-3">
                  <span className="text-xl shrink-0">{f.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-800">{f.label}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-neutral-400 leading-relaxed">
              ⓘ 각 계정은 독립된 워크스페이스를 가집니다.<br />
              본인 데이터는 본인 계정에서만 보이며, 다른 사용자에게 노출되지 않습니다.
            </div>
          </div>

          {/* 우측: 로그인 폼 */}
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 p-8">
            <h3 className="text-xl font-bold text-neutral-900 mb-1">로그인</h3>
            <p className="text-xs text-neutral-500 mb-6">계정으로 입장</p>
            <LoginForm next={nextPath} />
            <div className="mt-4 text-center text-xs text-neutral-500">
              계정이 없으세요? <a href="/signup" className="text-violet-600 hover:underline font-medium">회원가입</a>
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
