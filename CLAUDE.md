# Onmove — Claude 작업 컨텍스트

운동 센터 사장님용 SaaS. 라파 필라테스가 첫 사용자, 추가 가입 가능.

## 우선 읽기

1. **`AGENTS.md`** — multi-tenant 룰 + 도메인 룰 + Next.js 16 + 금지 사항
2. **`docs/PRD.md`** — 현재 제품 상태 + 핵심 기능 + 사용자
3. **`docs/ARCHITECTURE.md`** — 시스템 구조 + 데이터 흐름

## 사용자 컨텍스트

- 사용자: 이창환 (개발) + 유진 (여친, 라파 필라테스 원장)
- 톤: yes-man 금지. 약점·리스크 먼저 짚을 것. 비판적 검토 환영.
- 사용자가 비개발자 친화적이지만 결정은 본인이 함. 옵션을 명확히 제시.

## 작업 모드

- 한국어로 답변 (코드 주석/식별자 제외).
- 변경 후 commit/push는 명시적 요청 시에만.
- 큰 작업은 단계별 commit + rollback 가능하게.
- DB 마이그레이션 SQL은 사용자가 직접 실행 (Supabase SQL Editor). 멱등 패턴 필수.

@AGENTS.md
