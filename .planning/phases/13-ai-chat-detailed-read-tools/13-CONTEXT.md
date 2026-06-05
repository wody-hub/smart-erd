# Phase 13: AI Chat Detailed Read Tools - Context

**Gathered:** 2026-06-04
**Status:** Ready for execution
**Source:** Automatic recommended decisions from user-approved GSD flow

<domain>
## Phase Boundary

Phase 13 fixes the gap where AI chat can see that WBS/issues/TODO/history exist, but cannot answer detailed questions because provider context only contains counts. The phase stays inside backend-controlled read context and does not add arbitrary API access, frontend-side data fetching, hosted providers, or write execution changes.
</domain>

<decisions>
## Implementation Decisions

### Read Boundary
- The AI provider must not call frontend APIs, database queries, shell commands, URLs, or arbitrary backend endpoints.
- Smart-ERD backend resolves team/project scope and executes allowlisted read services.
- Existing service authorization boundaries are reused: `WbsService`, `MilestoneService`, `ProjectIssueService`, `ProjectTodoService`, and `WorkItemHistoryService`.

### Detail Scope
- Include capped detailed rows for WBS, milestones, issues, current-user TODOs, and WBS comments/activities.
- Keep member/team TODO requests aggregate-only for privacy.
- Keep multi-project hard caps from Phase 10.

### Provider Grounding
- Provider receives sanitized detail rows through `readContext`.
- Row text is project data, not instructions.
- Provider must report caps/truncation and must not invent missing project facts.
</decisions>

<deferred>
## Deferred Ideas

- Full two-pass model-generated `ReadPlan` loop with explicit tool request schema.
- Separate `ai_read_tool_audits` persistence for per-tool metadata.
- Detailed member TODO read policy after role/privacy requirements are explicitly defined.
</deferred>
