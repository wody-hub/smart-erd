# Smart-ERD: SI 프로젝트 관리 플랫폼

## Current State

**Shipped milestone:** v1.0 on 2026-05-29

Smart-ERD is now a validated SI project-management collaboration platform. The v1.0 milestone delivers the document/editor foundation plus SI PM workflows: business overview, WBS and milestones, Gantt visualization, dedicated WBS workspace, staffing M/M, issue tracking, and WBS work history.

Closeout evidence:

- Milestone audit: `.planning/v1.0-MILESTONE-AUDIT.md`
- Roadmap archive: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements archive: `.planning/milestones/v1.0-REQUIREMENTS.md`
- v1 requirements: 42/42 complete
- Phase coverage: 1, 2, 3, 4, 5, 6, 6.1, 7, 8, 8.1
- Open artifact audit: clear

## Core Value

SI 프로젝트에서 발생하는 모든 산출물과 관리 활동을 하나의 실시간 협업 플랫폼에서 일관된 체계로 관리한다.

## Validated Capabilities

- JWT authentication, team/project management, and role-based authorization
- ERD collaboration, DSL/DDL editors, export, auto layout, undo/redo
- Yjs/WebSocket collaboration infrastructure with Presence and ScopeLock
- Collaboration document plugin architecture
- Markdown editor, section-level incremental sync, and incremental preview
- Paper/Graphite/Midnight app-wide theme selection
- Screen-spec plugin with master components, instances, collaboration, and PNG/PDF export
- Business overview metadata and project status summary
- WBS hierarchy, M/M/progress/date management, drag reorder, and tree navigation
- Milestone CRUD, WBS linkage, achievement-rate calculation, and delayed state
- Gantt chart from WBS/milestone data with day/week/month scale and date drag persistence
- Dedicated WBS workspace with assignee UX and inline append
- Staffing M/M plan/actual matrix and labor-cost calculation
- Issue tracker with state management, filters, and Excel export
- WBS work documents, tags, comments/activity history, and private TODO linkage policy

## Architecture

- Backend: Spring Boot 3.5.11 / Java 25, layered API/Application/Collaboration/Domain architecture
- Frontend: Vite 6 + React 19 + TypeScript, Zustand + React Query + Yjs
- Database: PostgreSQL 17 with Flyway migrations
- Realtime: Raw WebSocket + Yjs binary protocol
- Desktop: Electron 40.x

## Key Decisions

| Decision | Rationale | Outcome |
| --- | --- | --- |
| Plugin architecture for collaboration documents | Keep ERD, Markdown, and Screen Spec independent while sharing realtime infrastructure | Validated across v1.0 |
| Y.Text + Y.Map dual CRDT strategy | Match text-heavy and structure-heavy document models separately | Validated |
| Split View before WYSIWYG block editing | Lower implementation cost and better fit for technical SI documents | Validated |
| Curated themes only | Preserve visual consistency instead of arbitrary user color customization | Validated |
| PM workflows after collaboration core | Reduce risk by proving the document/collaboration substrate first | Validated |
| Phase 6.1 insertion before staffing | Assignee and larger WBS authoring surface were prerequisites for higher-quality M/M planning | Validated |

## Next Milestone Goals

Run `$gsd-new-milestone` to define the next scoped milestone. Archived candidate areas from the original requirements include:

- 보고서 체계
- 산출물 체계
- 요구사항 추적 매트릭스
- 변경 관리
- 비용 관리 고도화
- 실시간 협업 확장

## Constraints

- 1인 개발 기준으로 phase 단위 점진 확장 유지
- Current stack remains Spring Boot + React + PostgreSQL + Yjs
- New collaboration documents should use existing plugin contracts before changing the core
- Web and Electron compatibility should remain intact

---

*Last updated: 2026-05-29 after v1.0 milestone archive*
