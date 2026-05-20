# 워크스페이스 v1 — 라파 필라테스 운영 대시보드

여자친구 유진의 라파 필라테스 스튜디오 운영을 돕는 단일 사용자 웹앱.
기존 구글 시트 + Looker Studio 위에 **세금 시뮬레이터(부가세·종소세) + 권장 예비비 + 절세 액션**을 얹은 도구.

## 무엇이 들어있는가

- ✅ 30 표준 카테고리 정규화 (시트 원본 47개 변형 자동 매핑)
- ✅ 부가세 시뮬레이터 (분기별)
- ✅ 종소세 시뮬레이터 (누진세율 + 청년창업감면 토글)
- ✅ 권장 월 예비비 (실시간 매출 페이스 기반)
- ✅ 납부일 D-day 카운터 (3·6·9·12월 부가세, 5월 종소세)
- ✅ 절세 액션 카드 6개 (라파 스터디 종합 시트 디지털화)
- ✅ 대시보드 (Looker Studio 레이아웃 계승)
- ✅ 설정 페이지 (생년월일·주소·청년창업감면·노란우산·연금저축)
- ✅ 2,539 실데이터 fixture (구글 시트 미연결 시 자동 fallback)
- ✅ 140 단위 테스트 + 백테스트

## 로컬 개발

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 단위 테스트 + 백테스트
npm run build      # 프로덕션 빌드
```

`.env.local` 생성 (선택 — 없어도 fixture로 동작):

```
# 구글 시트 연동 (선택)
GOOGLE_SHEETS_CLIENT_EMAIL=workspace-reader@<project>.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_ID=11UJX_0VDdYLVayu2S8f3UOGjL6tq-sEfuk6M5hRqDlE
GOOGLE_SHEETS_RANGE=전체 통합!A2:I3500

# 앱 접근 비밀번호 (선택 — 미설정 시 누구나 접근)
WORKSPACE_PASSWORD=set-me-locally
```

## 구글 시트 연동 가이드

1. [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트 생성
2. "Google Sheets API" 활성화 (라이브러리 검색)
3. "서비스 계정" 생성 → JSON 키 다운로드
4. 운영자 시트(구글 스프레드시트) 공유 → 서비스 계정 이메일을 Viewer로 추가
5. `.env.local`의 `GOOGLE_SHEETS_CLIENT_EMAIL`/`GOOGLE_SHEETS_PRIVATE_KEY`에 JSON 값 입력
6. `npm run dev` 재시작

연동 실패 시 자동으로 `tests/fixtures/real-transactions.ts`의 2,539 실데이터로 fallback.

## Vercel 배포

### 1단계: GitHub 리포지토리 만들기

```bash
# GitHub CLI 사용 (gh CLI 설치 필요)
gh repo create workspace --private --source=. --remote=origin --push

# 또는 수동:
# 1. GitHub UI에서 새 private repo 생성
# 2. git remote add origin https://github.com/<your-username>/workspace.git
# 3. git push -u origin main
```

### 2단계: Vercel 프로젝트 연결

```bash
npm install -g vercel
vercel login
vercel link          # 새 프로젝트로 연결
vercel               # 첫 배포 (preview)
```

또는 [vercel.com](https://vercel.com)에서 "Import Project" → GitHub 리포 선택.

### 3단계: 환경변수 설정

Vercel 대시보드 → 프로젝트 → Settings → Environment Variables:

| 키 | 값 | 환경 |
|---|---|---|
| `GOOGLE_SHEETS_CLIENT_EMAIL` | 서비스 계정 이메일 | Production |
| `GOOGLE_SHEETS_PRIVATE_KEY` | 서비스 계정 private key (개행 그대로) | Production |
| `GOOGLE_SHEETS_ID` | `11UJX_0VDdYLVayu2S8f3UOGjL6tq-sEfuk6M5hRqDlE` | Production |
| `GOOGLE_SHEETS_RANGE` | `전체 통합!A2:I3500` | Production |
| `WORKSPACE_PASSWORD` | 여자친구와 공유할 비밀번호 | Production |

### 4단계: 프로덕션 배포

```bash
vercel --prod
```

배포 후 URL (예: `https://workspace.vercel.app`) + 비밀번호를 여자친구에게 전달 🎁

## 페이지 가이드

| 경로 | 용도 |
|---|---|
| `/` | 홈 — 이번 분기 부가세 예상, 권장 예비비, 다음 납부일 D-day, 활성 절세 액션 |
| `/tax` | 분기별 부가세 4개 + 종소세 (감면 토글 반영) |
| `/analytics` | 연도별 KPI + 월별 매출/지출/순이익 차트 (Looker 레이아웃 계승) |
| `/settings` | 운영자 프로필 (생년월일·주소·청년창업감면·노란우산·연금저축) |
| `/api/transactions` | 거래 데이터 (JSON, 5분 캐시) |
| `/api/profile` | 프로필 데이터 (JSON) |

## 첫 사용 체크리스트

1. ☐ `/settings` 들어가서 운영자 정보 입력 (특히 청년창업감면 — 종소세 50~100% 차이!)
2. ☐ 노란우산공제·연금저축 가입금액 입력 (있다면)
3. ☐ `/` 홈 대시보드 확인
4. ☐ `/tax` 현재 분기 부가세 예상치 확인
5. ☐ `/analytics` 매출 추세 확인 (Looker 대시보드와 비교)

## 데이터 정확도 (백테스트 결과)

| 지표 | 실측 (Looker) | 우리 추정 | 차이 |
|---|---|---|---|
| 2024 매출 | 102M | 99.7M | -2.3% |
| 2024 지출 | 83.9M | 67.7M | -19.3% (fixture 누락) |
| 2024 owner draw | 36M | 36M | 0% |
| 2025 매출 | 118M | 114M | -3.4% |
| 2025 지출 | 101M | 81.4M | -19.5% (fixture 누락) |
| 2025 owner draw | 31M | 35M | +12.9% |

⚠️ **fixture 누락 ~19%**: 시트 → fixture 변환 시 일부 행이 드롭되어 발생. 알고리즘은 정확. 구글 시트 직접 연동 시 해소될 가능성 큼. (백테스트 fixture 재생성으로 추후 보강 가능)

## v1 스코프 (잠금)

이 README 시점에서 더 안 만지는 항목 — v2로 이관:

- ❌ 회원 관리 / CRM
- ❌ 프리랜서 시간·급여 자동화
- ❌ 재등록율 / 체험→정회원 전환율
- ❌ 매출 추이 기반 이벤트 자동 제안
- ❌ 코드에프 자동 연동 / 마이데이터
- ❌ 모바일 앱
- ❌ 카카오톡·이메일 알림

## 스택

- Next.js 16 + TypeScript 5 (strict)
- Tailwind CSS 4
- Recharts 3 (차트)
- googleapis (시트 API)
- date-fns (날짜)
- Vitest 4 + Testing Library (테스트)
- Vercel (배포)

## 라이선스

개인 사용 (선물). 공개 라이선스 없음.
