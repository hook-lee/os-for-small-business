# Onmove — 개발 문서

> 새 작업 시작 전 이 인덱스부터 훑고, 관련된 문서 1~2개 깊이 읽기.

---

## 📚 문서 5종

| # | 파일 | 한 줄 | 언제 읽나 |
|---|---|---|---|
| 1 | **[PRD.md](./PRD.md)** | 제품 의사결정의 기준점 (비전 · ICP · JTBD · 차별점 · 원칙) | "이 기능 만들어야 하나?" 판단 시 |
| 2 | **[IA.md](./IA.md)** | 사이트맵 · 네비게이션 · 페이지별 정보 구조 · 권한 모델 | 새 페이지 만들기 전, URL 정할 때 |
| 3 | **[USER-FLOWS.md](./USER-FLOWS.md)** | 사용자 시나리오 8개 (가입 / 결제 / 수업 / 정산 / 세금 / AI 비서 / 회원 페이지 / 강사) | "이 작업이 어떤 flow에 들어가나" 확인 |
| 4 | **[ROADMAP.md](./ROADMAP.md)** | 출시됨 / 다음 Phase 후보 (A~J) / 단·장기 / 안 할 것 | 다음 작업 우선순위 정할 때 |
| 5 | **[DECISIONS.md](./DECISIONS.md)** | ADR 10개 (Next.js 16 / Supabase / Gemini / multi-tenant / 매출 source / ...) | "왜 이런 구조지?" 의문 시 |

---

## 🔗 다른 핵심 reference

- **[`../AGENTS.md`](../AGENTS.md)** — Multi-tenant + 도메인 + Next.js 16 룰 (코드 작성 시 무조건 확인)
- **[`../CLAUDE.md`](../CLAUDE.md)** — 사용자 컨텍스트 + 작업 모드
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — 시스템 다이어그램 + 다층 보안
- **[MEMORY-UPDATE.md](./MEMORY-UPDATE.md)** — ~/.claude memory 업데이트 안내
- **[specs/2026-05-20-workspace-v1-design.md](./specs/2026-05-20-workspace-v1-design.md)** — v1 시점 원본 (archived, 참고용)

---

## 🛠️ 스킬 / 에이전트 (`.claude/`)

- **`add-feature` 스킬** — 새 기능 추가 절차 (DB → lib → API → UI → 테스트)
- **`multi-tenant-check` 스킬** — owner_id 격리 감사 절차
- **`tenant-auditor` agent** — read-only 자동 감사 (Glob/Grep/Read)

---

## ⬜ 빈칸 (사용자가 채워야 할 결정 사항)

각 문서에 `⬜` 마커로 표시됨. 가장 임팩트 큰 빈칸 4개:

1. **PRD §2 — 확장 ICP**: 라파 외 어떤 사장님 받을지?
2. **ROADMAP §다음 Phase**: A~J 중 1-3개 우선순위
3. **PRD §7 — 가격 정책**: 무료 유지 / Freemium / Flat / 사용량 중 어떤 모델
4. **DECISIONS D-2 — 강사 권한**: 분리 필요 / 라파 1인 운영이라 보류

---

## 🔄 문서 업데이트 룰

- 새 기능 추가 시 → PRD §4 + IA + USER-FLOWS 업데이트
- 새 기술 결정 시 → DECISIONS에 ADR 추가
- 우선순위 변경 시 → ROADMAP에 반영
- 폐기되는 기능 → 해당 문서에서 "Deprecated" 마킹 (삭제 X, 이유 기록)

---

## 작업 시작 표준 흐름

```
새 요청 들어옴
    ↓
PRD §3 JTBD 또는 §6 차별점에 해당하나?
   ├─ Yes → 기존 흐름의 일부?
   │        ├─ Yes → USER-FLOWS에서 위치 확인
   │        └─ No  → ROADMAP에 후보로 추가
   └─ No → "왜?" 토론 → 추가 또는 거절
    ↓
IA에서 어떤 페이지에 들어갈지 결정
    ↓
add-feature 스킬 따라 작업
    ↓
검증 (TS + tests + build) + 작업 후
multi-tenant-check 또는 tenant-auditor로 격리 확인
    ↓
DECISIONS에 ADR 추가 (큰 결정인 경우)
```
