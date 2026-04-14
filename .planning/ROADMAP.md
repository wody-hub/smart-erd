# Roadmap: Smart-ERD SI 프로젝트 관리 플랫폼

## Overview

현재 검증된 ERD 협업 코어와 마크다운 에디터 위에, 진행 중인 문서/에디터 완성 작업(Phase 1~3)을 마무리하고, SI 현장 맞춤형 PM 기능(사업 개요 → WBS+마일스톤 → 간트 → 인력 M/M → 이슈 트래커)을 단계적으로 추가한다. 각 단계는 이전 단계의 데이터를 기반으로 쌓이며, 이슈 트래커 완성 시점에 통합 SI PM 플랫폼 v1이 완성된다.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: 마크다운 증분 동기화** - Section 단위 증분 동기화 및 증분 프리뷰 렌더링 완성
- [x] **Phase 2: 테마 선택** - Paper/Graphite/Midnight 큐레이션 테마 전역 적용
- [ ] **Phase 3: 화면기획 플러그인** - 마스터 컴포넌트+인스턴스 화면 설계 도구 구현
- [ ] **Phase 4: 사업 개요** - 프로젝트 메타(발주처·계약·사업 범위) 등록 및 현황 조회
- [ ] **Phase 5: WBS + 마일스톤** - 계층 작업분해구조 편집과 마일스톤 관리
- [ ] **Phase 6: 간트 차트** - WBS 데이터 기반 타임라인 시각화 및 인터랙션
- [ ] **Phase 7: 인력 투입 (M/M)** - 팀원별 M/M 계획·실적 및 인건비 자동 계산
- [ ] **Phase 8: 이슈 트래커** - 이슈 등록·상태 관리·필터링·Excel 내보내기

## Phase Details

### Phase 1: 마크다운 증분 동기화
**Goal**: 마크다운 에디터에서 두 사용자가 같은 문서를 동시에 편집할 때 Section 단위로 효율적으로 동기화되고, 변경된 Section만 프리뷰가 재렌더링된다
**Depends on**: Nothing (기존 마크다운 플러그인 1차 구현 완료 상태에서 착수)
**Requirements**: DOC-01, DOC-02
**Success Criteria** (what must be TRUE):
  1. 두 사용자가 서로 다른 Section을 동시 편집할 때 각자의 변경이 충돌 없이 상대방에게 반영된다
  2. 한 Section을 수정하면 해당 Section의 프리뷰만 재렌더링되고 나머지 Section은 변경되지 않는다
  3. 단일 사용자 편집에서 기존 전체 동기화 대비 네트워크 전송량이 줄어든다
**Plans**: 7 plans

Plans:
- [x] 01-01-PLAN.md — diff-match-patch 설치 + SectionBoundary 순수 함수 라이브러리 (TDD)
- [x] 01-02-PLAN.md — BE MarkdownScopeResolver + MarkdownCollaborationPlugin
- [x] 01-03-PLAN.md — FE 증분 동기화 핵심 경로 (applyIncrementalTextUpdate + buildSectionCommands + MutationApplier 교체)
- [x] 01-04-PLAN.md — Section HTML 캐시 + useMarkdownSectionPreview + MarkdownDocumentPage 교체
- [x] 01-05-PLAN.md — [gap closure] 절대 offset 재계산 + RemotePendingBanner 배선
- [x] 01-06-PLAN.md — [gap closure] fenced code block 오탐 방지 + SectionPreviewCache GC
- [x] 01-07-PLAN.md — [gap closure] BE MarkdownScopeResolver payload 검증 강화

### Phase 2: 테마 선택
**Goal**: 사용자가 Paper/Graphite/Midnight 3가지 테마 중 하나를 선택하면 앱 전역(ERD 캔버스, 마크다운 에디터, Dialog, Monaco)에 일관되게 적용되고 새로고침 후에도 유지된다
**Depends on**: Nothing (Phase 1과 독립 진행 가능)
**Requirements**: THEME-01, THEME-02, THEME-03
**Success Criteria** (what must be TRUE):
  1. 사용자가 헤더에서 3가지 테마 중 하나를 선택할 수 있다
  2. 선택한 테마가 ERD 캔버스, 마크다운 에디터, 모달/Dialog, Monaco 에디터에 일관되게 반영된다
  3. 페이지를 새로고침하거나 브라우저를 다시 열어도 마지막으로 선택한 테마가 유지된다
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Theme foundation 계약 구현 (helper, store, bootstrap, hook)
- [x] 02-02-PLAN.md — 3-theme CSS variable rollout (Paper/Graphite/Midnight)
- [x] 02-03-PLAN.md — ThemeSwitcher dropdown UI to header

### Phase 3: 화면기획 플러그인
**Goal**: 화면기획 플러그인에서 마스터 컴포넌트를 정의하고 여러 화면에 인스턴스로 배치할 수 있으며, 실시간 협업과 산출물 내보내기가 동작한다
**Depends on**: Nothing (협업 코어 계약만으로 독립 구현 가능)
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04
**Success Criteria** (what must be TRUE):
  1. 사용자가 마스터 컴포넌트를 정의하고 여러 화면 캔버스에 인스턴스로 배치할 수 있다
  2. 마스터 컴포넌트를 수정하면 해당 마스터를 참조하는 모든 인스턴스에 자동으로 반영된다
  3. 두 사용자가 같은 화면기획 문서를 동시에 편집할 때 Yjs 기반 실시간 동기화가 동작한다
  4. 완성된 화면기획을 PNG 또는 PDF 파일로 내보낼 수 있다
**Plans**: In progress (plan 파일 미정의, 코드 선행 구현 진행 중)
**UI hint**: yes

구현 현황 (plan 파일 없이 코드 직접 구현됨):
- [x] screen-spec 문서 플러그인 골격 (DocumentPlugin, ScopeResolver, MutationApplier, MutationPolicy)
- [x] screen-design 페이지 UI (Canvas, Library, Inspector, EditorShell, PageState)
- [x] 마스터 컴포넌트 CRUD + 인스턴스 배치/이동/리사이즈
- [x] cross-screen move + constraint cascade + syncConstraintSource
- [x] 실시간 협업 Yjs 연동 (session, document runtime, bootstrap)
- [x] PNG/PDF 내보내기 파이프라인
- [ ] BE 백엔드 ScreenSpecCollaborationPlugin 완성 (scope resolver 연동 등)
- [ ] E2E 테스트 + QA 검증

### Phase 4: 사업 개요
**Goal**: 프로젝트에 발주처·계약 기간·계약 금액·사업 범위 등 SI 사업 메타 정보를 등록하고, 사업 개요 화면에서 프로젝트 전체 현황을 한눈에 파악할 수 있다
**Depends on**: Nothing (기존 Project 엔티티 확장으로 독립 착수 가능)
**Requirements**: BIZ-01, BIZ-02
**Success Criteria** (what must be TRUE):
  1. 사용자가 프로젝트에 발주처, 수주사, 계약 금액, 사업 기간, 사업 범위를 등록하고 수정할 수 있다
  2. 사업 개요 화면에서 프로젝트의 핵심 메타 정보와 현재 현황(진척률, 인원 등 요약)을 한 화면에서 확인할 수 있다
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 04-01-PLAN — BE 기반: Project 엔티티 확장 + Flyway 마이그레이션 + business-overview GET/PATCH API
- [ ] 04-02-PLAN — FE 기반: 타입/API/쿼리키 확장 + 번역 키 추가
- [ ] 04-03-PLAN — UI 구현: DiagramsPage 탭 도입 + BusinessOverviewTab 컴포넌트

**설계 결정:**
- UI 위치: DiagramsPage(문서 허브)에 `[문서] [사업 개요]` 탭으로 통합 (독립 라우트 신설 X)
- 엔티티: Project 테이블에 6개 nullable 컬럼 직접 추가 (별도 테이블 X)
- API: `PATCH .../business-overview` 별도 엔드포인트 (기존 PUT projects 확장 X — SRP)
- 금액: BIGINT 원 단위 (DECIMAL X — SI 계약금액은 정수 단위)
- 날짜: DATE 타입 (TIMESTAMP X — 사업기간은 날짜 개념)
- Phase 5 의존: `summary.progressRate: null` 고정 반환 → Phase 5에서 백엔드만 채우면 프론트 변경 없음

**필드 설계:**

| 필드 | 컬럼 | DB 타입 | Java 타입 | 비고 |
|---|---|---|---|---|
| 발주처 | `client_company` | VARCHAR(200) | String | nullable |
| 수주사 | `contractor_company` | VARCHAR(200) | String | nullable |
| 계약금액 | `contract_amount` | BIGINT | Long | nullable, 원 단위 |
| 사업기간 시작 | `project_start_date` | DATE | LocalDate | nullable |
| 사업기간 종료 | `project_end_date` | DATE | LocalDate | nullable |
| 사업범위 | `project_scope` | TEXT | String | nullable |

**리스크:**
- DiagramsPage 파일 크기 증가 → 기존 콘텐츠도 DocumentHubTabContent로 추출하여 SRP 유지
- contractAmount 표시 포맷 → `Intl.NumberFormat` 유틸 lib/에 추출, 인라인 금지
- projectStartDate > projectEndDate → 서비스 레이어에서 BusinessException 투척
- ProjectSettingsDialog와 기능 중복 → 의도적 분리 (기본정보 vs 사업메타)

### Phase 5: WBS + 마일스톤
**Goal**: 계층 구조(업무 > 세부작업 > 태스크)로 WBS를 편집하고, 담당자·기간·진척률·M/M을 설정하며, 마일스톤을 등록하고 WBS 완료와 연동하여 달성률을 추적할 수 있다
**Depends on**: Phase 4
**Requirements**: WBS-01, WBS-02, WBS-03, WBS-04, WBS-05, MILE-01, MILE-02, MILE-03, MILE-04
**Success Criteria** (what must be TRUE):
  1. 사용자가 계층 구조(최대 3단계)로 WBS 항목을 생성·편집·삭제할 수 있고 트리를 접기/펼치기로 탐색할 수 있다
  2. 각 WBS 항목에 담당자, 시작일, 종료일, 진척률, 예상 M/M을 설정할 수 있다
  3. 사용자가 WBS 행을 드래그 앤 드롭으로 이동하고 재배치할 수 있다
  4. 프로젝트에 마일스톤을 등록하고 연관 WBS 항목을 연결하면 달성률이 자동 계산된다
  5. 마일스톤 목표일 대비 지연 여부가 시각적으로 구분되어 표시된다
**Plans**: TBD
**UI hint**: yes

### Phase 6: 간트 차트
**Goal**: WBS 데이터를 기반으로 간트 차트가 자동 렌더링되고, 타임라인 단위 조절과 바 드래그로 기간을 변경하며, 마일스톤이 다이아몬드 마커로 표시된다
**Depends on**: Phase 5
**Requirements**: GANTT-01, GANTT-02, GANTT-03, GANTT-04
**Success Criteria** (what must be TRUE):
  1. WBS에 기간이 설정된 항목이 간트 차트에 자동으로 렌더링된다
  2. 사용자가 일/주/월 단위로 타임라인 줌을 전환할 수 있다
  3. 사용자가 간트 바를 드래그하여 WBS 항목의 시작일/종료일을 변경할 수 있다
  4. 마일스톤이 간트 차트에 다이아몬드 마커로 표시되고 목표일 지연 여부가 색으로 구분된다
**Plans**: TBD
**UI hint**: yes

### Phase 7: 인력 투입 (M/M)
**Goal**: 팀원별 투입 기간·참여율·등급·단가를 등록하고, 계획 대비 실적을 비교하며, 프로젝트 전체 인건비가 M/M × 단가로 자동 계산된다
**Depends on**: Phase 4
**Requirements**: HR-01, HR-02, HR-03, HR-04
**Success Criteria** (what must be TRUE):
  1. 사용자가 팀원별 투입 기간과 참여율(%)을 등록하고 편집할 수 있다
  2. 사용자가 팀원의 인력 등급(초급/중급/고급/특급)과 월 단가를 설정할 수 있다
  3. 계획 M/M 대비 실적 M/M을 비교하는 매트릭스 뷰를 확인할 수 있다
  4. 프로젝트 전체 인건비 합계가 각 팀원의 M/M × 단가로 자동 계산되어 표시된다
**Plans**: TBD
**UI hint**: yes

### Phase 8: 이슈 트래커
**Goal**: 이슈를 등록하고 상태(등록→처리중→완료)를 관리하며, 다양한 조건으로 필터링하고 Excel로 내보낼 수 있다
**Depends on**: Phase 4
**Requirements**: ISSUE-01, ISSUE-02, ISSUE-03, ISSUE-04
**Success Criteria** (what must be TRUE):
  1. 사용자가 이슈를 등록할 수 있다 (제목, 내용, 우선순위, 담당자)
  2. 이슈 상태를 등록 → 처리중 → 완료 순서로 변경할 수 있다
  3. 이슈 목록을 상태, 우선순위, 담당자 기준으로 필터링할 수 있다
  4. 현재 이슈 목록을 Excel 파일로 내보낼 수 있다
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 마크다운 증분 동기화 | 7/7 | Complete | 2026-04-03 |
| 2. 테마 선택 | 3/3 | Complete | 2026-04-03 |
| 3. 화면기획 플러그인 | -/? | In progress | - |
| 4. 사업 개요 | 0/? | Not started | - |
| 5. WBS + 마일스톤 | 0/? | Not started | - |
| 6. 간트 차트 | 0/? | Not started | - |
| 7. 인력 투입 (M/M) | 0/? | Not started | - |
| 8. 이슈 트래커 | 0/? | Not started | - |
