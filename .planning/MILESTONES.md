# Milestones

## v1.0 — SI PM MVP

**Status:** shipped
**Shipped:** 2026-05-29
**Phases:** 1, 2, 3, 4, 5, 6, 6.1, 7, 8, 8.1
**Plans:** 23/23 complete
**Requirements:** 42/42 complete
**Audit:** passed (`.planning/v1.0-MILESTONE-AUDIT.md`)
**Known deferred items at close:** 0

Archive:

- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`
- `.planning/milestones/v1.0-phases/`

Key outcomes:

- Document/editor foundation completed with Markdown incremental sync, theme selection, and Screen Spec authoring/export.
- SI PM workflows completed across business overview, WBS/milestones, Gantt, WBS workspace, staffing M/M, issue tracking, and WBS work history.
- Historical audit evidence gaps and debug sessions were closed before archival.

## v1.1 — AI 업무 실행 Gateway + Local Codex Chatbot

**Status:** planning
**Started:** 2026-05-29
**Phases:** 9, 10, 11, 12
**Requirements:** 23 planned
**Runtime direction:** Local/Electron MVP using Local Codex Adapter, with provider abstraction for later provider replacement

Planned outcomes:

- App AI chatbot for Smart-ERD project-management questions
- AI Tool Gateway with provider abstraction and Local Codex Adapter
- Server-controlled read tools for project overview, WBS, milestones, issues, TODOs, and WBS work history
- Structured action proposals with preview/diff, explicit approval, and cancel flow
- Audit log for prompts, tools, proposals, approval decisions, execution results, and errors
- Low-risk write MVP: issue create/update, personal TODO create/update, WBS comment/work memo add

Safety constraints:

- Delete/destructive actions are excluded from v1.1.
- AI never receives raw access tokens, session cookies, DB credentials, or arbitrary shell execution authority.
- Approved writes execute only through existing Smart-ERD application service/API boundaries.
