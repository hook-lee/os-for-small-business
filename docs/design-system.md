# Onmove 디자인 시스템 (v1)

> 목표: "팔리는 제품"을 위한 일관된 UI/UX. 모든 화면이 같은 토큰·컴포넌트를 쓰게.
> 톤: 현재 **보라-청록 포인트 유지·정제** (Geist 참고하되 우리 색 유지).

## 1. 색 (semantic)
| 용도 | 라이트 | 비고 |
|---|---|---|
| 브랜드(primary) | `violet-600` | 주요 버튼·활성 탭·링크 |
| 강조 그라데이션 | `from-violet-600 to-fuchsia-600` | 로고·목표 등 포인트만 (남발 X) |
| 청록 accent | `teal-600` | 보조 강조·아이콘 |
| 배경 | `neutral-50` | 페이지 |
| 표면 | `white` | 카드·입력 |
| 테두리 | `neutral-200` | |
| 본문 | `neutral-900` / muted `neutral-500` | |
| 성공/경고/위험 | `emerald` / `amber` / `red` | 600 텍스트, 50 배경 |

→ 다크모드(③단계)에서 이 값들을 CSS 변수로 토큰화해 쌍으로 정의.

## 2. 모양
- 모서리: 기본 `rounded-lg`(8px), 카드·컨테이너 `rounded-xl`(12px), pill `rounded-full`
- 그림자: 카드 `shadow-sm`, 떠있는 것(모달·토스트) `shadow-lg`
- 간격: 섹션 `space-y-4`, 요소 `space-y-2~3`, 패딩 카드 `p-4`

## 3. 타이포
- 크기: `text-2xl`(페이지 제목) · `text-lg`(섹션) · `text-sm`(본문) · `text-xs`(보조)
- 숫자: `tabular-nums`, 큰 숫자 모바일 `text-base sm:text-xl break-keep`

## 4. 컴포넌트 (이것만 쓰기)
- **Button** (`@/components/ui/Button`): variant=`primary`/`secondary`/`ghost`/`danger`, size=`sm`/`md`. 인라인 버튼 className 직접 쓰지 말 것.
- **Tabs** (`@/components/ui/Tabs`): pill 스타일. 밑줄 탭 금지.
- **Card** (`@/components/ui/Card`): 표면 컨테이너.
- **Badge** (`@/components/ui/Badge`): 상태 라벨(성공/경고/중립).
- Input/Select: `border border-neutral-300 rounded px-2 py-1.5 text-sm` (추후 컴포넌트화).

## 5. 적용 로드맵
1. ✅ 기반: 가이드 + Button + Tabs(+Badge)
2. ⬜ 사이드바 레이아웃(좌측 세로 + 카테고리 + 접기, 모바일 하단탭 유지)
3. ⬜ 다크/라이트 토글(토큰 CSS 변수화)
4. ⬜ 전 페이지 버튼·탭·입력 일괄 교체
