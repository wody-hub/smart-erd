# Architecture Research

**Domain:** SI 프로젝트 관리 플랫폼 (기존 협업 플랫폼 확장)
**Researched:** 2026-04-02
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Document    │  │  PM Pages    │  │  Report  │  │  Settings  │  │
│  │  Hub / ERD   │  │  WBS/Gantt   │  │  Pages   │  │  Pages     │  │
│  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  └─────┬──────┘  │
│         │                 │               │               │          │
│  ┌──────┴─────────────────┴───────────────┴───────────────┴──────┐  │
│  │              React Query + Zustand (State Layer)               │  │
│  └──────┬──────────────────────────────────────────────────┬─────┘  │
│         │ HTTP /api/*                      WebSocket ws://  │        │
├─────────┴──────────────────────────────────────────────────┴────────┤
│                        Backend (Spring Boot 3.5)                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐                 │
│  │  api/       │  │ application/│  │collaboration/│                 │
│  │  (REST)     │  │ (Service)   │  │  (Yjs WS)    │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘                 │
│         └────────────────┴─────────────────┘                         │
│  ┌────────────────────────────────────────────────┐                  │
│  │             domain/ (Entity + Repository)       │                  │
│  │  user / team / project / diagram /              │                  │
│  │  pm (WBS/Milestone/Resource) /                  │                  │
│  │  report / issue / dictionary                    │                  │
│  └────────────────────────────────────────────────┘                  │
├─────────────────────────────────────────────────────────────────────┤
│                     PostgreSQL 17 (Docker)                           │
│  teams · projects · diagrams · wbs_items · milestones ·             │
│  resources · report_templates · reports · issues                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `domain/pm/wbs` | WBS 작업 트리, 담당자, 진척률 | JPA 엔티티 + QueryDSL, 인접 리스트/중첩 셋 |
| `domain/pm/milestone` | 마일스톤, 산출물 연결, 완료 판정 | JPA 엔티티, Diagram/WBS 외래키 참조 |
| `domain/pm/resource` | 인력 투입 계획/실적, M/M 계산 | JPA 엔티티, TeamMember 참조 |
| `domain/pm/budget` | 예산/비용 항목 추적 | JPA 엔티티, 항목 열거형 + 금액 집계 |
| `domain/report` | 일/주/월간 보고서 저장, 템플릿 렌더링 | Diagram(마크다운 플러그인)과 연계 또는 독립 엔티티 |
| `domain/issue` | 이슈 등록, 담당자, 상태, 우선순위 | JPA 엔티티, TeamMember 참조 |
| `api/pm/*` | PM REST 엔드포인트 | Controller + DTO (record) |
| `client/pages/pm/*` | WBS/Gantt/Resource 페이지 | React Query + Zustand |
| `client/components/pm/*` | WBS Tree, Gantt Chart, Resource Table | 도메인 컴포넌트 |

## Recommended Project Structure

### Backend 신규 도메인 패키지

```
src/main/java/com/smarterd/
├── api/
│   ├── pm/                          # PM REST 엔드포인트
│   │   ├── wbs/                     #   WBS CRUD + 순서 이동
│   │   ├── milestone/               #   마일스톤 CRUD
│   │   ├── resource/                #   인력 투입 CRUD
│   │   └── budget/                  #   예산/비용 CRUD
│   ├── report/                      # 보고서 엔드포인트
│   └── issue/                       # 이슈 트래커 엔드포인트
└── domain/
    ├── pm/                          # 프로젝트 관리 도메인
    │   ├── wbs/
    │   │   ├── entity/WbsItem.java   #   작업 항목 (인접 리스트 트리)
    │   │   ├── repository/          #
    │   │   └── service/WbsService.java
    │   ├── milestone/
    │   │   ├── entity/Milestone.java
    │   │   └── service/MilestoneService.java
    │   ├── resource/
    │   │   ├── entity/ResourcePlan.java
    │   │   └── service/ResourceService.java
    │   └── budget/
    │       ├── entity/BudgetItem.java
    │       └── service/BudgetService.java
    ├── report/
    │   ├── entity/ReportTemplate.java
    │   ├── entity/Report.java
    │   └── service/ReportService.java
    └── issue/
        ├── entity/Issue.java
        └── service/IssueService.java
```

### Frontend 신규 구조

```
client/src/
├── pages/
│   ├── pm/
│   │   ├── WbsPage.tsx              # WBS 트리 + 인라인 편집
│   │   ├── GanttPage.tsx            # 간트 차트 시각화
│   │   ├── ResourcePage.tsx         # 인력 투입 현황
│   │   └── BudgetPage.tsx           # 예산/비용 현황
│   ├── report/
│   │   ├── DailyReportPage.tsx
│   │   ├── WeeklyReportPage.tsx
│   │   └── MonthlyReportPage.tsx
│   └── issue/
│       └── IssueListPage.tsx
├── components/
│   ├── pm/
│   │   ├── WbsTree.tsx              # 트리형 WBS 렌더링
│   │   ├── WbsRow.tsx               # 단일 WBS 행 (인라인 편집)
│   │   ├── GanttChart.tsx           # SVG/Canvas 간트 차트
│   │   ├── GanttBar.tsx             # 간트 바 단위 컴포넌트
│   │   ├── ResourceTable.tsx        # M/M 매트릭스 테이블
│   │   └── MilestoneTimeline.tsx    # 마일스톤 타임라인
│   ├── report/
│   │   ├── ReportEditor.tsx         # 마크다운 플러그인 기반 보고서 편집
│   │   └── ReportSummaryCard.tsx
│   └── issue/
│       ├── IssueCard.tsx
│       └── IssueFormDialog.tsx
├── api/
│   ├── wbsApi.ts
│   ├── milestoneApi.ts
│   ├── resourceApi.ts
│   ├── budgetApi.ts
│   ├── reportApi.ts
│   └── issueApi.ts
└── types/
    ├── wbs.ts
    ├── milestone.ts
    ├── resource.ts
    ├── budget.ts
    ├── report.ts
    └── issue.ts
```

### Structure Rationale

- **`domain/pm/` 하위 분리:** WBS/마일스톤/인력/예산은 각자 독립적 생명주기를 가진다. 같은 pm 패키지로 묶되 내부에서 역할별 서브패키지로 분리해 SRP를 지킨다.
- **`domain/report/` 독립 패키지:** 보고서는 pm/issue/diagram 여러 도메인의 집계 결과를 소비한다. 별도 패키지로 격리해 집계 로직이 도메인 엔티티를 오염시키지 않게 한다.
- **`components/pm/` 독립:** ERD/마크다운 컴포넌트와 마찬가지로 도메인별 컴포넌트 디렉토리를 사용한다. `components/layout/`은 절대 pm 상태에 의존하지 않는다 (기존 경계 원칙 유지).
- **`api/*Api.ts` 1대1 대응:** 기존 패턴(`teamApi.ts`, `projectApi.ts`)을 그대로 따른다. 페이지는 axiosInstance를 직접 호출하지 않는다.

## Architectural Patterns

### Pattern 1: 인접 리스트 WBS 트리

**What:** WBS 항목을 `parent_id` 자기 참조 외래키로 표현하는 인접 리스트 구조. PostgreSQL의 재귀 CTE(`WITH RECURSIVE`)로 전체 트리를 단일 쿼리로 조회한다.

**When to use:** WBS처럼 깊이가 예측 불가능하고 이동/재배치가 빈번한 계층 구조.

**Trade-offs:**
- 단순 CRUD는 쉽지만 깊이가 깊을수록 재귀 쿼리 비용 증가
- 중첩 셋(Nested Set) 대비 쓰기가 빠르고 이동이 단순
- SI WBS는 보통 3-5 레벨이라 성능 문제 없음

**Example:**
```sql
-- WBS 전체 트리 조회 (PostgreSQL)
WITH RECURSIVE wbs_tree AS (
    SELECT * FROM wbs_items WHERE parent_id IS NULL AND project_id = :projectId
    UNION ALL
    SELECT w.* FROM wbs_items w
    INNER JOIN wbs_tree t ON w.parent_id = t.id
)
SELECT * FROM wbs_tree ORDER BY sort_order;
```

```java
// QueryDSL Native Query wrapper (재귀 CTE는 QueryDSL 미지원 → Native 사용)
@Query(value = "WITH RECURSIVE ...", nativeQuery = true)
List<WbsItem> findTreeByProjectId(@Param("projectId") Long projectId);
```

### Pattern 2: 보고서 = 마크다운 플러그인 문서 + 메타 엔티티

**What:** 보고서 본문은 기존 `Diagram` 엔티티(마크다운 플러그인)를 재사용하고, 보고서 타입/주기/집계 메타는 별도 `Report` 엔티티로 관리한다. `Report`는 `Diagram.id`를 참조해 본문과 분리한다.

**When to use:** 보고서가 단순 서식 문서가 아니라 WBS 진척률, 인력 현황, 이슈 수 등을 자동 집계해야 할 때.

**Trade-offs:**
- 마크다운 에디터, 실시간 협업, 템플릿 시스템을 무료로 얻음
- 보고서 자동 집계 로직은 `ReportService`에서 별도로 구현 필요
- 집계 결과를 마크다운 Frontmatter에 주입하는 방식으로 연결 가능

**Example:**
```java
// Report 엔티티 — Diagram을 참조
@Entity
public class Report extends BaseAuditEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "diagram_id")
    private Diagram document;       // 마크다운 본문 문서

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @Enumerated(EnumType.STRING)
    private ReportType reportType;  // DAILY, WEEKLY, MONTHLY

    @Column(name = "report_date")
    private LocalDate reportDate;
}
```

### Pattern 3: 이슈 트래커 경량 상태 머신

**What:** 이슈 상태를 DB 열거형으로 관리하고, 허용된 상태 전이를 서비스 계층에서 검증한다. 복잡한 워크플로우 엔진 없이 `BusinessException`으로 불법 전이를 차단한다.

**When to use:** SI 이슈 트래커처럼 상태가 5개 이하이고 전이 규칙이 단순한 경우.

**Trade-offs:**
- 구현 단순, 유지보수 쉬움
- 상태 전이 이력 추적 불가 (필요 시 별도 `IssueHistory` 엔티티 추가)

**Example:**
```java
public enum IssueStatus {
    OPEN, IN_PROGRESS, RESOLVED, CLOSED, REOPENED;

    public boolean canTransitionTo(IssueStatus next) {
        return switch (this) {
            case OPEN -> next == IN_PROGRESS || next == CLOSED;
            case IN_PROGRESS -> next == RESOLVED || next == OPEN;
            case RESOLVED -> next == CLOSED || next == REOPENED;
            case REOPENED -> next == IN_PROGRESS;
            default -> false;
        };
    }
}
```

## Data Flow

### WBS 작업 진척률 업데이트 흐름

```
사용자: 하위 작업 진척률 변경
    ↓
WbsPage (React) → PATCH /api/teams/{teamId}/projects/{projectId}/wbs/{itemId}
    ↓
WbsService.updateProgress(itemId, progress)
    - WbsItem 조회 + 진척률 업데이트 (dirty checking)
    - 부모 WbsItem 자동 재계산 (하위 평균 가중치 적용)
    ↓
React Query invalidateQueries({ queryKey: queryKeys.wbs.byProject(projectId) })
    ↓
WbsTree + GanttChart 동시 리렌더 (동일 쿼리 키 구독)
```

### 보고서 자동 집계 흐름

```
사용자: 주간 보고서 생성 요청
    ↓
POST /api/teams/{teamId}/projects/{projectId}/reports
    ↓
ReportService.create(type=WEEKLY, date)
    1. Diagram(마크다운 플러그인) 생성 — 빈 문서
    2. 집계 데이터 수집:
       - WbsService.getSummary(projectId, weekRange) → 진척률
       - ResourceService.getWeeklySummary(projectId, weekRange) → 인력 현황
       - IssueService.getWeeklySummary(projectId, weekRange) → 이슈 수
    3. ReportTemplate에서 마크다운 Frontmatter 구성
    4. Diagram.content에 집계 결과 주입 후 저장
    5. Report 엔티티 생성 (diagram_id 참조)
    ↓
클라이언트: DiagramPage로 리다이렉트 (마크다운 에디터에서 보고서 편집)
```

### 마일스톤 완료 판정 흐름

```
사용자: 마일스톤 완료 처리
    ↓
PATCH /api/.../milestones/{id}/complete
    ↓
MilestoneService.complete(milestoneId)
    - 연결된 WbsItem 전부 100% 달성 여부 검증 → 미달성 시 BusinessException
    - 연결된 Diagram(산출물) 존재 여부 검증
    - Milestone.completedAt = Instant.now()
    ↓
응답: MilestoneDto (완료 상태, 완료 일시)
```

### Key Data Flows

1. **WBS → Gantt 단방향:** Gantt는 WBS 데이터를 읽기 전용으로 시각화. WBS를 수정하면 같은 React Query 캐시를 통해 Gantt도 자동 갱신.
2. **WBS/Issue → 보고서 집계:** 보고서 생성 시점에 WBS 진척률과 이슈 통계를 스냅샷으로 집계해 Diagram content에 저장. 이후 수정은 마크다운 에디터에서 자유롭게.
3. **Milestone → Diagram 참조:** 마일스톤이 산출물 Diagram을 참조. 마일스톤 완료 판정 시 참조 Diagram의 존재/상태 검증.
4. **TeamMember → Resource 참조:** 인력 투입 계획은 TeamMember를 참조. 팀 멤버가 제거되면 Resource 레코드는 유지 (이력 보존), 활성 상태 비활성화.

## Entity Relationship (신규 도메인)

```
Project
  ├─< WbsItem (parent_id 자기 참조 트리)
  │     └─ assignee: TeamMember (nullable)
  ├─< Milestone
  │     ├─ linkedDiagram: Diagram (nullable, 산출물)
  │     └─< MilestoneWbsLink (마일스톤-WbsItem M:N)
  ├─< ResourcePlan
  │     └─ member: TeamMember
  ├─< BudgetItem
  ├─< Report
  │     └─ document: Diagram (마크다운 플러그인)
  └─< Issue
        └─ assignee: TeamMember (nullable)
```

## Build Order (의존성 기반 구현 순서)

PM 기능은 서로 의존성이 있어 순서가 중요하다.

### Phase A: 기반 (다른 모든 PM 기능이 의존)
1. **사업 개요 (Project 메타 확장)** — `Project` 엔티티에 발주처, 계약 기간, 계약 금액 필드 추가. 다른 PM 기능의 컨텍스트 제공.

### Phase B: 일정 코어 (WBS + 마일스톤)
2. **WBS** — 인력/보고서/간트의 선행 조건. WbsItem 엔티티 + 재귀 조회 + 진척률 자동 계산.
3. **마일스톤** — WBS 완료 연동 검증이 있어 WBS 이후 구현.
4. **간트 차트** — WBS 데이터 시각화. WBS API 완성 후 프론트엔드만 구현.

### Phase C: 인력/비용
5. **인력 투입 관리** — TeamMember 참조. Team/Project 기반 완성 후 구현.
6. **비용 관리** — 인력 단가와 연동. 인력 관리 이후 구현.

### Phase D: 집계/보고
7. **이슈 트래커** — 독립 도메인. WBS/인력 이후 보고서 집계 소스로 활용.
8. **보고서 시스템** — WBS + 인력 + 이슈 집계가 모두 준비된 후 마지막. ReportTemplate + 자동 집계 + 마크다운 플러그인 연계.

## Integration Points

### 기존 아키텍처와의 경계

| 경계 | 통신 방식 | 고려 사항 |
|------|-----------|-----------|
| PM 도메인 ↔ Team/Project 도메인 | JPA 연관 + Service 직접 호출 | 순환 의존 방지 — PM은 Team/Project를 참조하지만 반대 방향은 없음 |
| PM 도메인 ↔ Diagram 도메인 | Diagram.id 외래키 참조 (단방향) | Report/Milestone → Diagram 참조. Diagram은 PM을 모름. |
| 보고서 집계 ↔ WBS/Issue/Resource | ReportService 내 서비스 직접 호출 | 집계는 읽기 전용(@Transactional readOnly). 순환 의존 없음 |
| PM 페이지 ↔ 협업 코어 (Yjs) | 없음 — PM 기능은 비실시간 | WBS/이슈는 HTTP REST만 사용. 실시간 협업은 문서(ERD/마크다운)에만 적용 |
| 프론트엔드 PM ↔ Layout | layout 컴포넌트는 PM 상태 미참조 | 기존 원칙 유지 — `components/layout/`은 도메인 store 의존 금지 |

### PM 기능에서 Yjs가 불필요한 이유

WBS/마일스톤/인력/이슈는 구조화된 폼 기반 편집이다. 동시 편집 충돌이 문자 수준이 아닌 행(레코드) 수준에서 발생하므로 낙관적 잠금(version 필드 + 409 응답) 또는 최종 쓰기 우선(Last Write Wins)으로 충분하다. Yjs는 텍스트/캔버스 문서에만 적용한다.

## Scaling Considerations

| 규모 | 아키텍처 조정 |
|------|-------------|
| 팀 1-10개 / 프로젝트 10개 이하 | 현재 단일 Spring Boot 인스턴스, 재귀 CTE 성능 충분 |
| 팀 100개 / WBS 수천 행 | WbsItem 인덱스 최적화 (`project_id`, `parent_id`), 보고서 집계 비동기 처리 고려 |
| 팀 1000개 이상 | 보고서 집계를 스케줄러 + 캐시 레이어로 분리 (현재 스택 범위 초과) |

현재 1인 사이드 프로젝트 맥락에서는 첫 번째 규모로 충분하다.

### 첫 번째 병목
**재귀 WBS 쿼리:** `project_id` + `parent_id` 복합 인덱스를 초기부터 생성한다. 재귀 깊이 제한(예: 10레벨)을 서비스 계층에서 강제한다.

### 두 번째 병목
**보고서 집계 동기 처리:** 초기에는 요청 시점 동기 집계로 구현하고, 느려질 경우 `@Async` + 캐시로 전환한다.

## Anti-Patterns

### Anti-Pattern 1: PM 기능에 Yjs 적용

**What people do:** WBS 항목을 Y.Map으로 실시간 동기화 시도
**Why it's wrong:** WBS 편집은 폼 기반 순차 작업이다. Yjs 도입 시 WBS 트리 동기화 로직이 폭발적으로 복잡해지고, 현재 플러그인 계약도 문서 편집 시나리오를 가정하고 있다.
**Do this instead:** HTTP REST + 낙관적 잠금. 동시 수정 충돌은 409 응답 + 클라이언트 재시도로 처리.

### Anti-Pattern 2: 보고서를 별도 엔티티로 완전 분리

**What people do:** 보고서 본문을 `report_content TEXT` 컬럼에 직접 저장
**Why it's wrong:** 실시간 협업, 마크다운 에디터, 템플릿 시스템을 처음부터 다시 구현해야 한다.
**Do this instead:** `Report` → `Diagram(마크다운 플러그인)` 참조 패턴. 보고서 생성 시 Diagram을 먼저 만들고 Report 메타 엔티티가 이를 참조한다.

### Anti-Pattern 3: WBS를 단일 JSON 컬럼으로 저장

**What people do:** `Project.wbs_json TEXT` 컬럼에 전체 WBS 트리를 직렬화
**Why it's wrong:** 항목별 담당자 배정, 진척률 쿼리, 마일스톤 연결이 불가능하다. 데이터 정합성 보장 불가.
**Do this instead:** `WbsItem` 엔티티로 정규화 + 인접 리스트 구조. 트리 조회는 재귀 CTE 사용.

### Anti-Pattern 4: 집계 로직을 PM 엔티티에 내장

**What people do:** `Project.getWeeklyProgress()` 같은 집계 메서드를 엔티티에 구현
**Why it's wrong:** 엔티티가 여러 도메인 서비스를 참조해야 하고 트랜잭션 경계가 모호해진다.
**Do this instead:** `ReportService`에서 각 도메인 서비스를 조합해 집계. 엔티티는 자신의 상태만 관리.

## Sources

- 기존 코드베이스 분석: `domain/diagram/entity/Diagram.java`, `domain/project/entity/Project.java`, `collaboration/registry/document-plugin-registry.ts`
- PROJECT.md 요구사항 분석 (2026-04-02)
- SI 프로젝트 관리 표준 패턴 (WBS/간트/마일스톤): PMI PMBOK 일정 관리 지식 영역
- PostgreSQL 재귀 CTE: https://www.postgresql.org/docs/current/queries-with.html
- Spring Data JPA 계층 구조: https://spring.io/projects/spring-data-jpa

---
*Architecture research for: SI 프로젝트 관리 플랫폼 PM 기능 확장*
*Researched: 2026-04-02*
