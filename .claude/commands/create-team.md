# Smart-ERD Creator 팀 생성

사용자의 요청을 분석하여 적절한 시나리오의 개발 팀을 구성하고, 태스크를 생성하여 팀원에게 배분한다.

## 사용법

```
/create-team <시나리오> <작업 설명>
```

- `시나리오`: fullstack, collab, refactor, investigate 중 하나 (생략 시 작업 내용으로 자동 판단)
- `작업 설명`: 팀이 수행할 작업 내용

## 팀 생성 절차

1. **시나리오 판단**: 인자 또는 작업 내용을 분석하여 아래 4개 시나리오 중 적합한 것을 선택
2. **팀 생성**: `TeamCreate`로 `smart-erd-creator` 팀 생성
3. **태스크 생성**: 작업 내용을 분석하여 Phase별 태스크를 `TaskCreate`로 생성 (의존 관계 포함)
4. **팀원 스폰**: 시나리오에 맞는 에이전트를 `Task` 도구로 스폰 (subagent_type: `general-purpose`, team_name: `smart-erd-creator`)
5. **태스크 배분**: 각 팀원에게 태스크를 `TaskUpdate`로 할당
6. **진행 관리**: 팀원 메시지를 수신하며 Phase별로 진행, 완료 시 다음 Phase 팀원 스폰

## 시나리오별 팀 구성

### 1. fullstack — 새 기능 개발 (기획 → 설계 → 구현 → 리뷰)

전체 기능을 처음부터 끝까지 개발하는 풀스택 시나리오.

| Phase | 에이전트 | 역할 | 병렬 |
|-------|----------|------|------|
| 1 | planner-designer | 기획서 작성 (사용자 스토리, 화면 설계, i18n 키) | 단독 |
| 2 | impl-architect | 기획서 → 구현 설계서 (API, 엔티티, 컴포넌트, 태스크 분해) | 단독 |
| 3 | be-developer | 백엔드 구현 (Entity, Repository, Service, Controller) | 병렬 |
| 3 | fe-developer | 프론트엔드 구현 (타입, API, 컴포넌트, 페이지) | 병렬 |
| 4 | reviewer | 통합 코드 리뷰 (아키텍처 + 개발 표준 + 디자인) | 단독 |

### 2. collab — 실시간 협업 기능 개발/수정

WebSocket + Yjs CRDT 관련 작업 시나리오.

| Phase | 에이전트 | 역할 | 병렬 |
|-------|----------|------|------|
| 1 | collab-developer | 협업 인프라 구현 (BE WebSocket + FE Yjs 프로바이더) | 단독 |
| 1 | be-developer | 협업 외 백엔드 작업 (API, 서비스 등) | 병렬 (필요 시) |
| 2 | reviewer | 통합 코드 리뷰 | 단독 |

### 3. refactor — 기존 코드 리팩토링/버그 수정

아키텍처 점검 결과를 바탕으로 기존 코드를 수정하는 시나리오.

| Phase | 에이전트 | 역할 | 병렬 |
|-------|----------|------|------|
| 1 | be-developer | 백엔드 수정 | 병렬 |
| 1 | fe-developer | 프론트엔드 수정 | 병렬 |
| 1 | collab-developer | 협업 인프라 수정 | 병렬 (필요 시) |
| 2 | reviewer | 수정 코드 리뷰 | 단독 |

### 4. investigate — 문제 조사/분석

코드 분석, 성능 프로파일링, 보안 점검 등 조사 시나리오.

| Phase | 에이전트 | 역할 | 병렬 |
|-------|----------|------|------|
| 1 | impl-architect | 코드 구조 분석 + 설계 제안 | 단독 |

## 에이전트 스폰 템플릿

각 에이전트를 스폰할 때 다음 형식을 사용한다:

```
Task 도구:
  subagent_type: general-purpose
  team_name: smart-erd-creator
  name: <에이전트명> (예: be-developer, fe-developer)
  prompt: |
    너는 smart-erd-creator 팀의 <에이전트명>이다.
    .claude/agents/<에이전트명>.md 파일을 읽고 역할과 규칙을 숙지하라.

    배정된 태스크:
    - TaskGet으로 태스크 상세를 확인
    - TaskUpdate로 in_progress 설정 후 작업 시작
    - 완료 시 TaskUpdate로 completed 설정
    - SendMessage로 팀 리드에게 결과 보고
```

## 팀 종료 절차

모든 Phase 완료 후:
1. 각 팀원에게 `SendMessage(type: shutdown_request)` 전송
2. 팀원들의 shutdown_response 수신 확인
3. `TeamDelete`로 팀 리소스 정리
4. 사용자에게 최종 결과 요약 보고

## 시나리오 자동 판단 기준

인자에 시나리오가 명시되지 않은 경우:
- **fullstack**: "기능 추가", "새 페이지", "CRUD", "~구현" 등 새 기능 키워드
- **collab**: "WebSocket", "Yjs", "실시간", "협업", "CRDT", "동기화" 등 협업 키워드
- **refactor**: "수정", "리팩토링", "버그", "점검 결과", "fix" 등 수정 키워드
- **investigate**: "분석", "조사", "점검", "왜", "원인" 등 조사 키워드
