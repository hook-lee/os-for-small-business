# memory 업데이트 가이드

Claude의 user memory(`~/.claude/projects/C--Users-leech-dev-business-os/memory/`)는 자동 누적이라 직접 수정 권장. 현재 `project_workspace.md`가 **v1 시점 가정**으로 박혀있어 코드 현실과 모순. 다음 세션에서 Claude가 옛 가정으로 작업할 위험.

## 업데이트 권장 — `project_workspace.md`

`C:/Users/leech/.claude/projects/C--Users-leech-dev-business-os/memory/project_workspace.md` 파일을 다음 내용으로 교체:

```markdown
---
name: Onmove — 운동 센터 사장님용 SaaS
description: 운동 스튜디오(필라테스/PT/요가) 1인 운영자 대상 회원·강사·매출·세금 통합 관리 + AI 비서 SaaS. 라파 필라테스(유진)가 최초 사용자.
type: project
originSessionId: 89fef756-573b-4446-82d6-e10208c1b33d
---

이전 단일 사용자 dashboard에서 multi-tenant SaaS로 전환된 상태 (2026-05-25).
v1 spec(`docs/specs/2026-05-20-workspace-v1-design.md`)은 archived.

**현재 상태**:
- 브랜드: **Onmove**
- 기술: Next.js 16 + Supabase (auth + Postgres + RLS) + Vercel + Gemini 2.5 Flash
- 사용자: raphapilatesyj@gmail.com + 추가 가입 가능
- DB: 14개 테이블 모두 owner_id 격리 + RLS 활성화
- 데이터: 라파 transactions 2,917건 (xlsx source of truth, 24-04~26-05)
- 보안: 보안 헤더 + rate limit + 인증 가드 다 적용

**핵심 기능 (구현 완료)**:
- 인증: 이메일/비번 로그인 + 회원가입 (`/signup`: 센터명·직급 필수)
- 거래 가계부, 회원·강사·수강권, 수업·그룹, 강사 급여
- 월별 요약 대시보드 (`/finances`): 매출·영업이익·순수익·결제수단별
- 세금 페이지 (`/tax`): 간이/일반 전환 타임라인 + 1억800만 임계점 모니터링 + 분기별 부가세 + 실측 세금
- AI 비서: 우하단 floating, 페이지 컨텍스트 인지, 7개 tool
- 회원 토큰 페이지: `/m/[token]/*` (인증 우회)

**핵심 reference 파일** (`workspace/`):
- `AGENTS.md` — multi-tenant + 도메인 룰
- `CLAUDE.md` — @AGENTS.md + 작업 모드
- `docs/PRD.md` — 현재 제품 상태
- `docs/ARCHITECTURE.md` — 시스템 구조
- `.claude/skills/add-feature/` — 새 기능 추가 절차
- `.claude/skills/multi-tenant-check/` — 격리 감사
- `.claude/agents/tenant-auditor.md` — 자동 격리 검증 agent

**사용자 의사결정**:
- yes-man 금지. 약점·리스크 먼저.
- DB 마이그레이션은 사용자가 Supabase SQL Editor에서 직접 실행.
- git commit/push는 명시적 요청 시만.
- 데이터 source of truth = 사용자가 직접 입력 (transactions). 외부 import는 참고용.
```

## 업데이트 권장 — `MEMORY.md` (인덱스)

```markdown
- [User · 사업 배경](user_business_background.md) — 여자친구 필라테스 스튜디오(연 1억대) 운영을 옆에서 관찰·관리해온 파트너. 본인 OS 만들기 중.
- [Feedback · 비판적 검토 요청](feedback_critique_mode.md) — yes-man 금지, 약점·리스크 먼저 짚을 것. 사용자 명시 요청.
- [Project · Onmove (multi-tenant SaaS)](project_workspace.md) — 운동 센터 사장님용 SaaS. v1 (선물 프로젝트) → multi-tenant SaaS 전환 완료 (2026-05-25).
- [Reference · 작업 디렉토리](reference_workspace_paths.md) — workspace 경로 + 핵심 파일 위치.
```

## 수정 방법

방법 1 (가장 간단): 사용자가 위 두 파일을 에디터로 열어 직접 교체.

방법 2: Claude에게 `/remember` 같은 명령으로 추가 정보 누적 — 다만 옛 내용을 자동으로 안 지움.

방법 3: 위 두 파일을 직접 삭제 → 다음 세션 시작할 때 새 컨텍스트가 다시 박힘.

## 왜 이게 중요한가

memory는 새 세션이 시작될 때 Claude가 자동으로 읽는 컨텍스트. v1 가정("선물 프로젝트, ICP=1명, DB 없음")이 박혀있으면 다음 세션에서:
- 새 lib 함수 만들 때 owner_id 깜빡할 수 있음
- multi-tenant 가정 없이 single-tenant 코드 작성
- DB 마이그레이션을 사용자 시점에서 수동 실행 필요한 걸 모를 수 있음

AGENTS.md를 매번 읽긴 하지만, memory의 잘못된 가정이 priming을 먼저 함. **AGENTS.md + memory 둘 다 정합**되어야 안정.
