# Roadmap: Smart-ERD SI 프로젝트 관리 플랫폼

## Milestones

- [x] **v1.0: SI PM MVP** — shipped 2026-05-29. Completed phases 1, 2, 3, 4, 5, 6, 6.1, 7, 8, and 8.1 with 42/42 v1 requirements verified. See `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`, and `.planning/milestones/v1.0-phases/`.
- [ ] **v1.1: AI 업무 실행 Gateway + Local Codex Chatbot** — active planning. Adds a local/Electron AI chatbot, provider abstraction, Smart-ERD read tools, approval-gated low-risk write tools, and audit logging.

## Overview

v1.1 turns the existing SI PM workflows into AI-accessible tools without handing the model raw credentials or direct database access. The first runtime is local/Electron: the user's PC must have Codex CLI installed and logged in, and Smart-ERD invokes it through a Local Codex Adapter. The architecture must still expose a provider interface so later implementations can use OpenAI API, Ollama, Claude, or another provider.

The milestone is deliberately approval-gated. AI can read scoped project context and propose low-risk create/update actions, but Smart-ERD validates the proposal, shows a preview/diff, and only executes through existing service/API boundaries after the user approves. Delete and destructive actions are excluded.

## Phases

- [x] **Phase 9: AI Tool Gateway + Provider Abstraction** — provider contract, Local Codex Adapter, structured output schema, execution status, timeout/cancel/error handling (completed 2026-06-01)
- [x] **Phase 10: App AI Chat UI + Read-Only Context Tools** — in-app chatbot shell, project context selection, read tools for project overview, WBS, milestones, issues, TODOs, and work history (gap closure planned 2026-06-04) (completed 2026-06-04)
- [ ] **Phase 11: Approval Preview + Audit Execution Pipeline** — action proposal schema, preview/diff, approval/cancel flow, execution boundary, audit log and history
- [ ] **Phase 12: Low-Risk Write Tools MVP** — issue create/update, personal TODO create/update, WBS comment/work memo add, all approval-gated

## Phase Details

### Phase 9: AI Tool Gateway + Provider Abstraction

**Goal**: Smart-ERD can call an AI provider through a stable gateway contract, with Local Codex Adapter as the first implementation.
**Depends on**: v1.0 shipped PM APIs and Electron runtime
**Requirements**: AI-RUN-01, AI-RUN-02, AI-RUN-03, AI-RUN-04, AI-SEC-01
**Success Criteria** (what must be TRUE):

  1. The app can report whether the Local Codex runtime is available and usable.
  2. AI provider calls go through a provider abstraction rather than direct UI-to-Codex coupling.
  3. Local Codex Adapter runs `codex exec` non-interactively and requests structured JSON output.
  4. Provider calls enforce timeout, cancellation, output validation, error mapping, and log redaction.
  5. Raw access tokens, session cookies, and database credentials are never inserted into model prompts.

**Plans**: 09-01 ✅, 09-02 ✅, 09-03 ✅
**UI hint**: no

### Phase 10: App AI Chat UI + Read-Only Context Tools

**Goal**: A user can ask project-management questions inside Smart-ERD and receive answers grounded in authorized project data.
**Depends on**: Phase 9
**Requirements**: AI-CHAT-01, AI-CHAT-02, AI-READ-01, AI-READ-02, AI-READ-03, AI-READ-04
**Success Criteria** (what must be TRUE):

  1. The app exposes an AI chatbot surface suitable for the local/Electron MVP.
  2. The user can select or inherit the active team/project context for AI questions.
  3. AI read tools can retrieve project overview, WBS, milestones, issues, TODOs, and WBS work history through server-controlled APIs.
  4. Every read tool validates the current user, team, project, and resource scope before returning data.
  5. Chat responses distinguish available project facts from model inference.

**Plans**: 10 plans (7 executed, 3 gap closure planned)
Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Wave 0 validation contract for backend, frontend, and drawer smoke coverage
- [x] 10-02-PLAN.md — Backend scope resolver and summary-first read context services
- [x] 10-04-PLAN.md — Frontend chat types, safe local persistence, and route-context hints

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-03-PLAN.md — Backend `/api/ai/chat` HTTP contract and read-only chat orchestration
- [x] 10-05-PLAN.md — Frontend typed chat API and send/cancel execution hook

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10-06-PLAN.md — Sectioned answer, source chip, context bar, and composer UI components

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 10-07-PLAN.md — Global authenticated drawer mounting and final phase verification

**Gap Closure Wave** *(planned after Phase 10 verification gaps)*

- [x] 10-08-PLAN.md — Provider grounding summaries and shared provider context privacy
- [x] 10-09-PLAN.md — Member TODO aggregate privacy and required scope authorization dependency
- [x] 10-10-PLAN.md — Team MULTI_PROJECT chat contract and unsupported selectedResource removal

**UI hint**: yes

### Phase 11: Approval Preview + Audit Execution Pipeline

**Goal**: AI-proposed actions become explicit, reviewable Smart-ERD execution proposals before any mutation occurs.
**Depends on**: Phase 9, Phase 10
**Requirements**: AI-ACT-01, AI-APP-01, AI-APP-02, AI-APP-03, AI-AUD-01, AI-AUD-02, AI-AUD-03
**Success Criteria** (what must be TRUE):

  1. AI write intent is represented as a structured action proposal, not free-form executable text.
  2. Smart-ERD validates action type, target scope, required fields, and authorization before showing approval.
  3. The user sees a preview/diff and can approve or cancel each proposal.
  4. Approved writes execute only through existing service/API boundaries.
  5. Prompt metadata, tool calls, proposals, approvals, cancellations, execution results, and errors are audit logged.

**Plans**: TBD
**UI hint**: yes

### Phase 12: Low-Risk Write Tools MVP

**Goal**: The AI chatbot can help users perform a small set of practical create/update workflows after explicit approval.
**Depends on**: Phase 11
**Requirements**: AI-WRITE-01, AI-WRITE-02, AI-WRITE-03, AI-WRITE-04, AI-WRITE-05
**Success Criteria** (what must be TRUE):

  1. A user can approve AI-proposed issue create/update actions.
  2. A user can approve AI-proposed personal TODO create/update actions.
  3. A user can approve AI-proposed WBS comment or work memo additions.
  4. Delete and destructive action proposals are rejected before approval.
  5. Invalid, unauthorized, or rejected proposals do not mutate project data.

**Plans**: TBD
**UI hint**: yes

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AI-RUN-01 | Phase 9 | Complete |
| AI-RUN-02 | Phase 9 | Complete |
| AI-RUN-03 | Phase 9 | Complete |
| AI-RUN-04 | Phase 9 | Complete |
| AI-SEC-01 | Phase 9 | Complete |
| AI-CHAT-01 | Phase 10 | Complete |
| AI-CHAT-02 | Phase 10 | Complete |
| AI-READ-01 | Phase 10 | Complete |
| AI-READ-02 | Phase 10 | Complete |
| AI-READ-03 | Phase 10 | Complete |
| AI-READ-04 | Phase 10 | Complete |
| AI-ACT-01 | Phase 11 | Planned |
| AI-APP-01 | Phase 11 | Planned |
| AI-APP-02 | Phase 11 | Planned |
| AI-APP-03 | Phase 11 | Planned |
| AI-AUD-01 | Phase 11 | Planned |
| AI-AUD-02 | Phase 11 | Planned |
| AI-AUD-03 | Phase 11 | Planned |
| AI-WRITE-01 | Phase 12 | Planned |
| AI-WRITE-02 | Phase 12 | Planned |
| AI-WRITE-03 | Phase 12 | Planned |
| AI-WRITE-04 | Phase 12 | Planned |
| AI-WRITE-05 | Phase 12 | Planned |
