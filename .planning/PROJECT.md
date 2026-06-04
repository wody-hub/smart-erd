# Smart-ERD: SI 프로젝트 관리 플랫폼

## Current State

**Active milestone:** v1.1 — AI 업무 실행 Gateway + Local Codex Chatbot
**Previous shipped milestone:** v1.0 on 2026-05-29

Smart-ERD is a validated SI project-management collaboration platform. The v1.0 milestone delivered the document/editor foundation plus SI PM workflows: business overview, WBS and milestones, Gantt visualization, dedicated WBS workspace, staffing M/M, issue tracking, and WBS work history.

The v1.1 milestone extends those project-management workflows with an in-app AI chatbot and a controlled AI execution gateway. Phases 9-11 are complete: the provider gateway, read-only chat context tools, and approval-preview/audit proposal shell are validated. The next active work is Phase 12, which registers concrete low-risk write executors for issue, TODO, and WBS comment/memo actions.

Closeout evidence:

- Milestone audit: `.planning/v1.0-MILESTONE-AUDIT.md`
- Roadmap archive: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements archive: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Phase artifact archive: `.planning/milestones/v1.0-phases/`
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
- AI provider gateway with Local Codex Adapter availability, structured output validation, timeout/error handling, and metadata-only audit
- In-app authenticated AI chat drawer with authorized project/team context, read-only project tools, and grounded answer sections
- Persisted AI action proposals with server-generated preview, approve/cancel lifecycle, project AI history, redacted audit metadata, and no production write executors before Phase 12

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
| AI writes require explicit user approval | Prevent accidental project mutations while allowing create/update workflows | v1.1 scope |
| Local Codex Adapter first, provider abstraction always | Enable API-keyless local MVP now without locking the architecture to Codex CLI | v1.1 scope |
| AI never receives raw access tokens or direct DB write access | Keep authorization and mutation enforcement inside Smart-ERD service boundaries | v1.1 constraint |

## Active Milestone Goals

Milestone v1.1 delivers:

- Provider abstraction with a Local Codex Adapter using `codex exec`
- In-app AI chatbot entry point for local/Electron usage
- Read-only Smart-ERD tools for project overview, WBS, milestones, issues, TODOs, and WBS work history
- Structured AI action proposals for low-risk create/update operations
- Preview/diff, explicit approval, and cancel flow before any write execution
- Audit logging for prompts, tool calls, proposals, approvals, and execution results
- Low-risk write MVP: issue create/update, personal TODO create/update, WBS comment/work memo add

Explicitly excluded from v1.1:

- Delete or destructive actions
- Direct database writes by AI
- Raw access-token exposure to model prompts
- Arbitrary shell command execution by AI
- Production shared-server multi-user Codex credential model
- SaaS-hosted AI runtime

## Constraints

- 1인 개발 기준으로 phase 단위 점진 확장 유지
- Current stack remains Spring Boot + React + PostgreSQL + Yjs
- New collaboration documents should use existing plugin contracts before changing the core
- Web and Electron compatibility should remain intact
- All AI-visible data must pass through server-side scope and authorization checks
- All write actions must use existing domain services or application APIs after approval
- Local Codex execution must have timeout, cancellation, structured output validation, and log redaction

---

*Last updated: 2026-06-04 after Phase 11 completion*
