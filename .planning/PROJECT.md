# Smart-ERD: SI 프로젝트 관리 플랫폼

## What This Is

SI 프로젝트의 전체 생명주기를 관리하는 실시간 협업 플랫폼. 팀 > 프로젝트 체계 아래에서 사업 개요, 인력 투입, WBS, 마일스톤, 화면설계서, ERD, 기술 문서, 비용 관리, 일일/주간/월간 보고서를 통합 관리한다.

현재는 ERD 다이어그램 설계와 마크다운 기반 문서 편집을 시범 구현한 상태이며, 이 두 기능이 플랫폼의 실시간 협업 코어(Yjs + WebSocket)와 문서 플러그인 아키텍처를 검증하는 역할을 한다.

## Core Value

SI 프로젝트에서 발생하는 모든 산출물과 관리 활동을 **하나의 실시간 협업 플랫폼**에서 일관된 체계로 관리할 수 있어야 한다.

## Requirements

### Validated

현재 코드베이스에서 검증 완료된 기능:

- ✓ JWT 기반 인증/인가 (회원가입, 로그인, Refresh Token 로테이션) — existing
- ✓ 팀 생성/관리, 멤버 초대/역할(ADMIN, MEMBER, VIEWER) — existing
- ✓ 프로젝트 CRUD (팀 소속) — existing
- ✓ ERD 다이어그램 설계 (React Flow 캔버스, 테이블/컬럼/FK 관계) — existing
- ✓ ERD DSL/DDL 코드 에디터 (Monaco Editor, PostgreSQL/MySQL/MSSQL) — existing
- ✓ ERD 이미지/PDF 내보내기 — existing
- ✓ ERD dagre 자동 레이아웃 — existing
- ✓ ERD Undo/Redo — existing
- ✓ 실시간 협업 인프라 (Yjs CRDT + WebSocket, Presence, ScopeLock) — existing
- ✓ 협업 문서 플러그인 아키텍처 (CollaborationChannelPlugin, DocumentPlugin Registry) — existing
- ✓ 마크다운 에디터 플러그인 1차 구현 (Split View, Monaco + 프리뷰, 문서 템플릿) — existing
- ✓ 마크다운 Frontmatter 안전성 강화 (YAML 파싱 실패 시 원본 보존) — Phase 6
- ✓ 마크다운 비동기 Worker 프리뷰 (Web Worker 파이프라인) — Phase 9-A
- ✓ 문서 허브 목록 성능 최적화 (summary 컬럼, content 로딩 제거) — Phase 8
- ✓ 데이터 사전 시스템 (도메인, 용어, 단어, 사전셋, 일괄 업로드/다운로드) — existing
- ✓ 다국어 지원 ko/en (프론트 i18next + 백엔드 MessageSource) — existing
- ✓ 문서 플랫폼 진입 UX/UI 개선 (문서 허브, 새 문서 생성) — existing
- ✓ Electron 데스크톱 앱 (macOS, Windows) — existing
- ✓ 마크다운 증분 동기화 (Section-Update 방식) — Validated in Phase 1: markdown-incremental-sync
- ✓ 마크다운 증분 프리뷰 렌더링 — Validated in Phase 1: markdown-incremental-sync
- ✓ 테마 선택 기능 (Paper/Graphite/Midnight 3개 큐레이션 테마) — Validated in Phase 2: 테마-선택

### Active

현재 진행 중이거나 곧 착수할 기능:

- [ ] 화면기획 플러그인 — Figma식 컴포넌트/인스턴스/화면 설계 도구

### Future — SI 프로젝트 관리 확장

ERD/문서/화면기획 기반이 완성된 후 확장할 SI 프로젝트 관리 영역:

**사업 관리**
- [ ] 사업 개요 관리 (프로젝트 메타: 발주처, 계약 기간, 계약 금액, 사업 범위)
- [ ] 인력 투입 계획 및 실적 관리 (역할별 M/M, 투입 기간, 단가)
- [ ] 비용 관리 (예산 대비 실적, 인건비/경비/외주비 항목별 추적)

**일정 관리**
- [ ] WBS (Work Breakdown Structure) — 작업 분해, 담당자 배정, 기간/진척률
- [ ] 마일스톤 관리 — 주요 이정표, 산출물 연결, 완료 판정
- [ ] 간트 차트 시각화

**산출물 관리**
- [ ] 화면설계서 구현 (화면기획 플러그인 기반 산출물 내보내기)
- [ ] 산출물 체계 관리 (단계별 산출물 목록, 검수 상태, 버전 관리)
- [ ] ERD → DDL → DB 마이그레이션 연계

**보고서**
- [ ] 일일 보고서 (당일 작업 내역, 이슈, 익일 계획)
- [ ] 주간 보고서 (주간 진척, 이슈/리스크, 다음 주 계획)
- [ ] 월간 보고서 (월간 실적, 마일스톤 달성률, 인력/비용 현황)
- [ ] 보고서 템플릿 시스템 + 자동 집계

**협업/커뮤니케이션**
- [ ] 이슈 트래커 (등록, 담당자 배정, 상태 관리, 우선순위)
- [ ] 회의록 관리 (마크다운 문서 플러그인 활용)
- [ ] 알림/공지 시스템

### Out of Scope

- 자유 색상 커스터마이징 (큐레이션 테마만 제공) — 테마 일관성 유지
- WYSIWYG 블록 에디터 (Notion 스타일) — Split View 우선, 후속 검토
- Figma 수준의 벡터/이미지 편집 — 화면기획은 와이어프레임/레이아웃 수준
- Git 연동 / 버전 관리 — 문서 자체 버전 관리로 대체
- OAuth 소셜 로그인 — JWT email/password 충분
- 모바일 앱 — 웹 + 데스크톱(Electron) 우선

## Context

**프로젝트 성격:** 1인 사이드 프로젝트로 시작, SI 현장 경험을 기반으로 한 프로젝트 관리 도구 개발. 실무에서 겪는 산출물/일정/인력 관리의 파편화를 해결하는 것이 동기.

**현재 아키텍처:**
- Backend: Spring Boot 3.5.11 / Java 25, 4-layer (API/Application/Collaboration/Domain)
- Frontend: Vite 6 + React 19 + TypeScript, Zustand + React Query + Yjs
- DB: PostgreSQL 17 (Docker), Flyway 마이그레이션
- 실시간: Raw WebSocket + Yjs binary protocol, 문서 플러그인 아키텍처
- 데스크톱: Electron 40.x (macOS/Windows)

**플러그인 체계:** 협업 코어 위에 문서 타입별 플러그인이 올라가는 구조가 이미 검증됨.
- ERD Plugin: 캔버스 + DSL 텍스트, Y.Map 중심
- Markdown Plugin: 텍스트 편집기, Y.Text 중심
- Screen Spec Plugin (설계 중): 캔버스 + 속성 패널, Y.Map 중심

**기존 설계 문서:** `plan/` 디렉토리에 27건 완료, 3건 진행 중. GSD 워크플로우와 별도로 운영 중.

## Constraints

- **1인 개발:** 모든 설계/구현/테스트를 혼자 수행 — 페이즈 단위로 점진적 확장 필수
- **Tech stack 고정:** Spring Boot + React + PostgreSQL + Yjs — 현재 스택 유지
- **코어 수정 제로 원칙:** 새 플러그인은 기존 협업 코어 계약만으로 동작해야 함
- **Electron 호환:** 웹/데스크톱 동시 지원 유지

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 플러그인 아키텍처 채택 | 문서 타입별 독립 확장, 코어 안정성 보장 | ✓ Good — ERD/Markdown 두 플러그인으로 검증 |
| Y.Text + Y.Map 이중 CRDT 전략 | 텍스트 중심(Markdown)과 구조 중심(ERD) 문서 특성에 맞는 최적화 | ✓ Good |
| Split View 우선 (WYSIWYG 후순위) | 구현 비용 대비 효과 최적, 기술 문서에 적합 | ✓ Good |
| localStorage 테마 저장 (서버 저장 미구현) | 빠른 제공 우선, 사용자 preference API 부재 | — Pending |
| ERD/문서 먼저, PM 기능 나중에 | 협업 코어 검증 후 관리 기능 확장이 리스크 최소화 | — Pending |
| Phase 6.1 WBS 작업공간 확장 삽입 | Phase 7 전에 WBS assignee 입력/넓은 authoring surface를 먼저 닫아야 인력 M/M 입력 품질이 확보됨 | — Planned (RIS-126) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-16 after RIS-126 Phase 6.1 creation*
