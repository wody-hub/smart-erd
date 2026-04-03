# Requirements: Smart-ERD SI 프로젝트 관리 플랫폼

**Defined:** 2026-04-02
**Core Value:** SI 프로젝트에서 발생하는 모든 산출물과 관리 활동을 하나의 실시간 협업 플랫폼에서 일관된 체계로 관리

## v1 Requirements

### 현재 진행 중 — 문서/에디터 완성

- [x] **DOC-01**: 마크다운 에디터에서 두 사용자가 다른 Section을 동시 편집할 때 Section 단위 증분 동기화가 동작한다
- [x] **DOC-02**: 마크다운 에디터에서 변경된 Section만 프리뷰가 재렌더링된다 (증분 프리뷰)
- [ ] **THEME-01**: 사용자가 헤더에서 Paper/Graphite/Midnight 테마를 선택할 수 있다
- [x] **THEME-02**: 선택한 테마가 앱 전역(ERD, 마크다운, Dialog, Monaco)에 일관되게 적용된다
- [x] **THEME-03**: 새로고침 후에도 선택한 테마가 유지된다
- [ ] **SPEC-01**: 화면기획 플러그인에서 마스터 컴포넌트를 정의하고 여러 화면에 인스턴스로 배치할 수 있다
- [ ] **SPEC-02**: 마스터 컴포넌트를 수정하면 모든 인스턴스에 자동 반영된다
- [ ] **SPEC-03**: 화면기획 플러그인이 기존 협업 코어(Yjs, ScopeLock, Presence) 위에서 실시간 협업된다
- [ ] **SPEC-04**: 화면기획 결과를 산출물(PNG/PDF)로 내보낼 수 있다

### 사업 개요

- [ ] **BIZ-01**: 프로젝트에 사업 메타 정보를 등록할 수 있다 (발주처, 수주사, 계약금액, 사업기간, 사업범위)
- [ ] **BIZ-02**: 사업 개요 화면에서 프로젝트 전체 현황을 한눈에 파악할 수 있다

### WBS (작업분해구조)

- [ ] **WBS-01**: 계층 구조(업무 > 세부작업 > 태스크)로 WBS를 편집할 수 있다
- [ ] **WBS-02**: 각 WBS 항목에 담당자, 시작일, 종료일, 진척률을 설정할 수 있다
- [ ] **WBS-03**: WBS 항목에 예상 M/M(투입공수)를 설정할 수 있다
- [ ] **WBS-04**: WBS 항목을 드래그 앤 드롭으로 이동/재배치할 수 있다
- [ ] **WBS-05**: WBS 트리를 접기/펼치기로 탐색할 수 있다

### 간트 차트

- [ ] **GANTT-01**: WBS 데이터를 기반으로 간트 차트가 자동 렌더링된다
- [ ] **GANTT-02**: 간트 차트에서 일/주/월 단위로 타임라인을 조절할 수 있다
- [ ] **GANTT-03**: 간트 차트에서 바를 드래그하여 기간을 변경할 수 있다
- [ ] **GANTT-04**: 마일스톤이 간트 차트에 다이아몬드 마커로 표시된다

### 마일스톤

- [ ] **MILE-01**: 프로젝트에 마일스톤을 등록할 수 있다 (이름, 목표일, 설명)
- [ ] **MILE-02**: 마일스톤에 연관 WBS 항목을 연결할 수 있다
- [ ] **MILE-03**: 마일스톤 달성률이 연결된 WBS 항목의 진척률로 자동 계산된다
- [ ] **MILE-04**: 마일스톤 목표일 대비 지연 상태가 시각적으로 표시된다

### 인력 투입 (M/M)

- [ ] **HR-01**: 팀원별 투입 기간과 참여율을 등록할 수 있다
- [ ] **HR-02**: 인력 등급(초급/중급/고급/특급)과 월 단가를 설정할 수 있다
- [ ] **HR-03**: 투입 계획 대비 실적을 비교할 수 있다
- [ ] **HR-04**: 프로젝트 전체 인건비가 M/M × 단가로 자동 계산된다

### 이슈 트래커

- [ ] **ISSUE-01**: 이슈를 등록할 수 있다 (제목, 내용, 우선순위, 담당자)
- [ ] **ISSUE-02**: 이슈 상태를 관리할 수 있다 (등록 → 처리중 → 완료)
- [ ] **ISSUE-03**: 이슈 목록을 상태/우선순위/담당자별로 필터링할 수 있다
- [ ] **ISSUE-04**: 이슈 목록을 내보낼 수 있다 (Excel)

## v2 Requirements

### 보고서 체계

- **RPT-01**: 일일 보고서를 작성할 수 있다 (당일 작업, 이슈, 익일 계획)
- **RPT-02**: 주간 보고서가 WBS 진척 + 이슈 현황으로 자동 집계된다
- **RPT-03**: 월간 보고서가 마일스톤 달성률 + M/M 현황 + 비용으로 자동 집계된다
- **RPT-04**: 보고서를 PDF/Word로 내보낼 수 있다

### 산출물 체계

- **ARTIFACT-01**: 단계별(분석/설계/구현/시험/전개) 산출물 목록을 관리할 수 있다
- **ARTIFACT-02**: 산출물에 플랫폼 내 문서(ERD, 마크다운, 화면설계서)를 연결할 수 있다
- **ARTIFACT-03**: 산출물 상태(미작성/작성중/검수중/완료)를 추적할 수 있다

### 요구사항 추적 매트릭스 (RTM)

- **RTM-01**: 요구사항 → 설계 → 구현 → 테스트 추적 테이블을 편집할 수 있다
- **RTM-02**: 추적 상태를 시각적 대시보드로 확인할 수 있다

### 변경 관리

- **CHG-01**: 변경 요청을 등록하고 승인 프로세스를 관리할 수 있다
- **CHG-02**: 변경 이력이 시간순으로 기록된다

### 비용 관리 고도화

- **COST-01**: 예산 대비 실적을 항목별(인건비/경비/외주비)로 추적할 수 있다
- **COST-02**: 비용 시뮬레이션으로 M/M 변경 시 예상 비용을 즉시 확인할 수 있다

### 실시간 협업 확장

- **COLLAB-01**: WBS/간트를 Yjs 기반 실시간 공동 편집할 수 있다
- **COLLAB-02**: WBS ↔ ERD ↔ 화면설계서 산출물이 직접 연결된다

## Out of Scope

| Feature | Reason |
|---------|--------|
| Agile/스프린트 관리 (번다운 차트 등) | 한국 SI는 폭포수 납품 계약이 지배적, WBS+마일스톤으로 충분 |
| 타임시트/시간 단위 기록 | SI는 일/주 단위 보고, 시간 단위 입력 거부감 높음. M/M 월 단위가 계약 기준 |
| 이메일 통합 | 별도 시장(Gmail/Outlook). 회의록 + 공지로 내부 소통 관리 |
| 인사/급여 시스템 연동 | 회사별 인사 시스템 다양, 연동 비용 높음. 단가 수동 입력으로 대체 |
| 파일 저장소 (드라이브 기능) | 용량/버전 관리 복잡. 외부 링크 + 플랫폼 내 문서로 커버 |
| AI 기반 일정 자동 추천 | 훈련 데이터 부족, SI 편차 극심. 명시적 WBS 입력 우선 |
| WYSIWYG 블록 에디터 | Split View 우선, 후속 검토 |
| 자유 색상 커스터마이징 | 큐레이션 테마 3개로 일관성 유지 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOC-01 | Phase 1 | Complete |
| DOC-02 | Phase 1 | Complete |
| THEME-01 | Phase 2 | Pending |
| THEME-02 | Phase 2 | Complete |
| THEME-03 | Phase 2 | Complete |
| SPEC-01 | Phase 3 | Pending |
| SPEC-02 | Phase 3 | Pending |
| SPEC-03 | Phase 3 | Pending |
| SPEC-04 | Phase 3 | Pending |
| BIZ-01 | Phase 4 | Pending |
| BIZ-02 | Phase 4 | Pending |
| WBS-01 | Phase 5 | Pending |
| WBS-02 | Phase 5 | Pending |
| WBS-03 | Phase 5 | Pending |
| WBS-04 | Phase 5 | Pending |
| WBS-05 | Phase 5 | Pending |
| MILE-01 | Phase 5 | Pending |
| MILE-02 | Phase 5 | Pending |
| MILE-03 | Phase 5 | Pending |
| MILE-04 | Phase 5 | Pending |
| GANTT-01 | Phase 6 | Pending |
| GANTT-02 | Phase 6 | Pending |
| GANTT-03 | Phase 6 | Pending |
| GANTT-04 | Phase 6 | Pending |
| HR-01 | Phase 7 | Pending |
| HR-02 | Phase 7 | Pending |
| HR-03 | Phase 7 | Pending |
| HR-04 | Phase 7 | Pending |
| ISSUE-01 | Phase 8 | Pending |
| ISSUE-02 | Phase 8 | Pending |
| ISSUE-03 | Phase 8 | Pending |
| ISSUE-04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after ROADMAP.md initialization*
