# Smart-ERD Codex 팀 생성

사용자 요청을 분석해 **가상 개발팀**(역할 기반)을 구성하고, Codex 단일 에이전트가 Phase 단위로 오케스트레이션하여 작업을 수행한다.

## 사용법

```bash
/create-codex-team <시나리오> <작업 설명>
```

- `시나리오`: fullstack, collab, refactor, investigate 중 하나 (생략 시 자동 판단)
- `작업 설명`: 팀이 수행할 작업 내용

## 핵심 원칙

1. 실제 멀티 에이전트/팀 API(`TeamCreate`, `TaskCreate`, `TaskUpdate`)는 사용하지 않는다.
2. Codex가 단일 실행 주체로서 역할을 전환하며 팀을 시뮬레이션한다.
3. 독립 가능한 작업은 `multi_tool_use.parallel`로 병렬 처리한다.
4. 각 Phase는 `계획 → 구현 → 검증 → 리뷰` 게이트를 통과해야 다음 Phase로 진행한다.

## Codex 팀 생성 절차

1. **시나리오 판단**: 인자 또는 작업 내용을 분석해 4개 시나리오 중 선택
2. **팀 헌장 생성**: 목표/범위/제약/완료 조건 정의
3. **태스크 보드 생성**: Phase별 태스크와 의존 관계를 Markdown 보드로 생성
4. **역할 배정**: Phase별 담당 역할을 지정하고 우선순위 확정
5. **Phase 실행**: 역할 전환하며 구현, 병렬 가능 구간은 병렬 처리
6. **검증/리뷰**: 빌드/테스트/리뷰 체크리스트로 품질 게이트 통과 확인
7. **최종 보고**: 변경 파일, 검증 결과, 잔여 리스크, 후속 액션 요약

## 시나리오별 가상 팀 구성

### 1. fullstack — 새 기능 개발 (기획 → 설계 → 구현 → 리뷰)

| Phase | 역할 | 작업 | 병렬 |
|-------|------|------|------|
| 1 | planner-designer | 요구사항 정리, 사용자 흐름, API 초안, i18n 키 정의 | 단독 |
| 2 | impl-architect | 구현 설계(데이터 모델, 모듈 경계, 태스크 분해) | 단독 |
| 3 | be-developer | 백엔드 구현 (Entity/Repository/Service/Controller) | 병렬 |
| 3 | fe-developer | 프론트 구현 (types/api/components/pages) | 병렬 |
| 4 | reviewer | 통합 리뷰 및 리그레션 점검 | 단독 |

### 2. collab — 실시간 협업 기능 개발/수정

| Phase | 역할 | 작업 | 병렬 |
|-------|------|------|------|
| 1 | collab-developer | WebSocket/Yjs/CRDT 경로 구현 및 동기화 안정화 | 단독 |
| 1 | be-developer | 협업 외 백엔드 보완(API/서비스/DB) | 병렬(필요 시) |
| 2 | reviewer | 동시성/무결성/보안 중심 리뷰 | 단독 |

### 3. refactor — 기존 코드 리팩토링/버그 수정

| Phase | 역할 | 작업 | 병렬 |
|-------|------|------|------|
| 1 | be-developer | 백엔드 구조 개선/버그 수정 | 병렬 |
| 1 | fe-developer | 프론트 구조 개선/버그 수정 | 병렬 |
| 1 | collab-developer | 협업 인프라 개선/버그 수정 | 병렬(필요 시) |
| 2 | reviewer | 변경 영향도 및 회귀 리뷰 | 단독 |

### 4. investigate — 문제 조사/분석

| Phase | 역할 | 작업 | 병렬 |
|-------|------|------|------|
| 1 | impl-architect | 원인 분석, 재현 경로, 해결 옵션 제안 | 단독 |

## 역할 전환 템플릿

Codex는 아래 템플릿으로 역할을 전환해 작업한다.

```text
[ROLE] <역할명>
- 목표:
- 입력:
- 산출물:
- 완료 조건:
```

## 태스크 보드 포맷

```markdown
## Team Charter
- Scenario: <fullstack|collab|refactor|investigate>
- Goal:
- Scope:
- Out of Scope:
- Done Definition:

## Task Board
| ID | Phase | Role | Task | Depends On | Status |
|----|-------|------|------|------------|--------|
| T1 | 1 | planner-designer | ... | - | todo |
| T2 | 2 | impl-architect | ... | T1 | todo |
| T3 | 3 | be-developer | ... | T2 | todo |
| T4 | 3 | fe-developer | ... | T2 | todo |
| T5 | 4 | reviewer | ... | T3,T4 | todo |
```

`Status` 값: `todo`, `in_progress`, `blocked`, `review`, `done`

## 병렬 처리 규칙 (Codex)

1. 파일 탐색/조회/로그 수집은 `multi_tool_use.parallel` 우선
2. 서로 독립인 변경 검증(예: 다수 파일 lint/read)은 병렬 실행
3. 순서 의존이 있는 편집/검증은 순차 실행
4. 병렬 실행 전, 충돌 가능성(같은 파일 동시 편집)을 먼저 차단

## 검증 게이트

각 Phase 종료 시 최소 아래를 확인한다.

1. 컴파일/빌드 성공 (`./gradlew compileJava`, `npm run build` 등 해당 범위)
2. 테스트 또는 재현 시나리오 확인
3. 컨벤션 점검(`review-dev.md`, `review-arch.md`, 필요 시 `review-design.md`)
4. 변경 영향 및 롤백 포인트 확인

## 팀 종료 절차 (Codex)

모든 Phase 완료 후:

1. Task Board 상태를 모두 `done` 또는 `blocked`로 확정
2. 변경 파일/핵심 diff/검증 결과를 요약
3. 잔여 리스크와 후속 작업(선택지) 제시
4. 사용자 승인 시 커밋/푸시/PR 단계 진행

## 시나리오 자동 판단 기준

- **fullstack**: "기능 추가", "새 페이지", "CRUD", "구현"
- **collab**: "WebSocket", "Yjs", "실시간", "협업", "CRDT", "동기화"
- **refactor**: "수정", "리팩토링", "버그", "fix", "점검 결과 반영"
- **investigate**: "분석", "조사", "원인", "왜", "점검"

## 주의사항

1. 존재하지 않는 팀/태스크 도구 호출을 가정하지 않는다.
2. 실제 가능한 도구 범위 내에서만 실행 계획을 수립한다.
3. 사용자 승인 없이 파괴적 명령(`reset --hard`, 대량 삭제 등)을 수행하지 않는다.
