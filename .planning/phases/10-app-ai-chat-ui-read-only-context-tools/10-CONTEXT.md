# Phase 10: App AI Chat UI + Read-Only Context Tools - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers the first usable in-app AI chat experience for Smart-ERD. A logged-in user can open a global AI drawer from any screen, ask project-management questions, and receive answers grounded in Smart-ERD project data that the server read tools fetched after authorization and scope checks.

This phase includes the chat shell, client-side conversation persistence, context selection/display, read-only AI context tools for project overview, WBS, milestones, issues, TODOs, and WBS work history/comments, plus response presentation that separates facts from inference.

This phase does not implement server-stored chat history, AI audit/history UI, write action proposals, approval previews, action execution, delete/destructive actions, hosted providers, or provider credential management.

</domain>

<decisions>
## Implementation Decisions

### Chat Entry and Persistence
- **D-01:** Use a global right-side AI drawer, not a page-local panel, AI tab, or bottom-right floating widget.
- **D-02:** The drawer is available after login from every app screen, not only project-detail screens.
- **D-03:** Drawer open state and conversation messages survive route changes.
- **D-04:** Conversation messages survive browser refresh through browser-local persistence, not server persistence.
- **D-05:** A conversation resets only when the user explicitly chooses "new conversation". Route changes, refreshes, and context changes must not reset it.
- **D-06:** The AI surface must support questions that name a project or compare work across projects; it must not be hard-bound to a single project screen.

### Context Selection and Disambiguation
- **D-07:** Default query context is inherited from the current route when a team/project context exists.
- **D-08:** The drawer must allow the user to change context manually.
- **D-09:** Screens with weak project context, such as team list, dictionary, or settings, must require an explicit scope before project-data questions can run.
- **D-10:** Multi-project questions may expand to all accessible projects in the current team.
- **D-11:** Phase 10 excludes all-team/all-project querying across every team.
- **D-12:** If a project name is ambiguous, misspelled, or conflicts with the current route context, the assistant must ask a confirmation question before answering.
- **D-13:** The drawer shows a persistent context bar for the current scope.
- **D-14:** Each answer also shows source chips for the actual context used.

### Read Tool Selection and Data Depth
- **D-15:** Read tools are selected per question. Do not inject a full project bundle into every provider request.
- **D-16:** Tool selection covers project/business overview, WBS, milestones, issues, TODOs, and WBS work history/comments.
- **D-17:** Read tool output is summary-first by default: counts, status/priority distributions, delayed/risky/incomplete/unassigned items, and recent changes.
- **D-18:** Detailed lists or item details are fetched only when the user asks for detail or follow-up context requires it.
- **D-19:** TODO reads default to the current user's own TODOs.
- **D-20:** If the user explicitly asks for team/project member TODO status and authorization permits it, the AI may read member-wide TODO summaries.
- **D-21:** Member-wide TODO reads must remain summary-oriented by default and must not expose private TODO detail unnecessarily.
- **D-22:** WBS work history/comment reads default to recent activity/comment summaries.

### Response Presentation
- **D-23:** AI answers use a card-style structure that separates "confirmed facts", "interpretation/proposal", and "needs confirmation".
- **D-24:** Source chips show project + tool + count, for example `A Project - issues 12`, `B Project - WBS 34`, or `Current team - projects 4`.
- **D-25:** Default answer tone is work-report style: conclusion first, then risks, delays, and next checks in short form.
- **D-26:** When project, scope, period, or target is unclear, ask a confirmation question before giving a guessed answer.

### Security and Phase Boundaries
- **D-27:** All AI-visible project data must be assembled by server-side read tools after user, team, project, and resource authorization checks.
- **D-28:** The frontend must call Spring HTTP APIs through typed API modules and must not call Codex, Electron IPC, or provider runtime directly.
- **D-29:** Raw access tokens, refresh tokens, session cookies, DB credentials, and arbitrary backend environment values must never be included in prompts, provider context, frontend responses, or local chat storage.
- **D-30:** Server-stored chat history, audit/history UI, action proposals, preview/diff, approval, and write execution remain out of Phase 10.

### the agent's Discretion
- The planner may choose exact component names, store shape, and local persistence mechanism, but must preserve the global drawer behavior, route-independent persistence, user-controlled new conversation reset, and server-only read-tool authorization boundary.
- The planner may choose exact read tool endpoint shapes, but must keep read tools summary-first and question-selected rather than always bundling all project data.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone and Requirements
- `.planning/PROJECT.md` - v1.1 milestone goals, AI safety constraints, provider abstraction, and approval-gated AI principle.
- `.planning/REQUIREMENTS.md` - Phase 10 requirements AI-CHAT-01, AI-CHAT-02, AI-READ-01, AI-READ-02, AI-READ-03, and AI-READ-04.
- `.planning/ROADMAP.md` - Phase 10 goal, dependency on Phase 9, success criteria, and explicit Phase 11/12 boundaries.
- `README.md` - AI extension architecture, Harness Engineering sequence, structured AI output rules, and forbidden direct LLM usage patterns.

### Prior Phase Contract
- `.planning/phases/09-ai-tool-gateway-provider-abstraction/09-CONTEXT.md` - provider gateway contract, local Codex boundary, status/execute/cancel APIs, sanitized context policy, and Phase 10 handoff decision that rich read tools belong here.
- `.planning/phases/09-ai-tool-gateway-provider-abstraction/09-01-SUMMARY.md` - backend AI gateway, Noop provider, execution registry, validation, and metadata-only audit foundation.
- `.planning/phases/09-ai-tool-gateway-provider-abstraction/09-02-SUMMARY.md` - Local Codex provider, process runner, sandbox, schema, and environment filtering.
- `.planning/phases/09-ai-tool-gateway-provider-abstraction/09-03-SUMMARY.md` - typed frontend AI provider API, status hook, and compact status badge.

### Codebase Architecture Maps
- `.planning/codebase/STACK.md` - Spring Boot, React, Electron, React Query, axios, shadcn/Radix, i18n, and testing stack.
- `.planning/codebase/ARCHITECTURE.md` - API/Application/Domain layering, React Query/Zustand frontend state split, and error handling.
- `.planning/codebase/CONVENTIONS.md` - API module pattern, React Query rules, i18n, JSDoc/Javadoc, semantic styling, and backend exception conventions.

### Existing AI Gateway and Frontend Entry Points
- `src/main/java/com/smarterd/api/ai/AiProviderController.java` - Phase 9 provider HTTP contract to extend or wrap for chat execution.
- `src/main/java/com/smarterd/application/ai/AiExecutionGateway.java` - current authorization preflight and sanitized provider context; Phase 10 read-tool context enrichment connects here or through a new application service around it.
- `client/src/api/aiProviderApi.ts` - typed frontend AI provider API module pattern.
- `client/src/hooks/useAiProviderStatus.ts` - existing React Query status hook and polling policy.
- `client/src/components/ai/AiProviderStatusBadge.tsx` - existing localized provider status surface.
- `client/src/components/workspace/ProjectWorkspaceHero.tsx` - current utility action area where the status badge already appears.
- `client/src/pages/project/ProjectsPage.tsx` - current project/team workspace entry point and AI status badge placement.

### Existing PM Read Boundaries
- `src/main/java/com/smarterd/api/project/ProjectController.java` - project detail and business overview read APIs.
- `src/main/java/com/smarterd/api/project/WbsController.java` - WBS tree, dependencies, comments, and activities read/write API shape.
- `src/main/java/com/smarterd/api/project/MilestoneController.java` - milestone list API shape.
- `src/main/java/com/smarterd/api/project/ProjectIssueController.java` - issue list/filter API shape.
- `src/main/java/com/smarterd/api/project/ProjectTodoController.java` - personal TODO API and current privacy boundary.
- `src/main/java/com/smarterd/domain/pm/common/ProjectContextLoader.java` - existing team/project authorization context loader.
- `src/main/java/com/smarterd/application/ai/SelectedResourceValidator.java` - selected-resource scope validation from Phase 9.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/api/aiProviderApi.ts` - extend the typed API module pattern for chat execution, status lookup, cancel, and future read-tool responses.
- `client/src/hooks/useAiProviderStatus.ts` - reuse the AI query key namespace and React Query style for chat/provider state.
- `client/src/components/ai/AiProviderStatusBadge.tsx` - keep as provider status indicator; add a separate global drawer trigger instead of overloading the badge.
- `client/src/components/workspace/ProjectWorkspaceHero.tsx` - the existing utility action slot can still host project-local AI affordances, but the drawer itself must live above page components.
- `ProjectContextLoader` and `SelectedResourceValidator` - reuse for read tool authorization before any project data enters provider context.
- PM controllers/services for project overview, WBS, milestones, issues, TODOs, and work history - use as the source of truth for read tool data, preferably through application-layer read services instead of duplicating authorization logic in the AI provider adapter.

### Established Patterns
- Backend controllers are thin and delegate to domain services or application use cases.
- Frontend server state goes through React Query and API modules; pages/components must not call `axiosInstance` directly.
- Frontend local UI state can use Zustand when state must persist across routes; Phase 10 global drawer state fits this pattern.
- Frontend strings must use i18n keys and semantic color tokens.
- Provider/runtime details stay behind backend provider abstractions; React and Electron do not run Codex directly.
- Existing API errors use localized domain exceptions; provider execution failures stay typed in AI execution results.

### Integration Points
- Add global AI drawer state near the app shell/router layer so it survives route changes.
- Persist the local conversation in browser storage with redaction-minded constraints and a user-visible new conversation action.
- Add a route-context resolver hook that derives current team/project/resource context from route params and page state where available.
- Add backend read-tool application services that gather summary-first project data after authorization, then enrich provider context.
- Extend provider output/response DTOs enough to carry response sections, confirmation prompts, source chips, and read-tool metadata without enabling writes.

</code_context>

<specifics>
## Specific Ideas

- The user wants a chat drawer that stays open while moving between screens.
- The AI should be available from all logged-in screens because users may ask cross-project questions.
- The AI must support questions such as "compare incomplete issues by project" or "show risky work across this team".
- Ambiguous project names should produce a chooser inside the drawer, not a guessed answer.
- Source chips should look like `A Project - issues 12`, `B Project - WBS 34`, or `Current team - projects 4`.
- Answer cards should separate confirmed facts, interpretation/proposal, and needs confirmation.
- The default tone should be concise SI PM work-report style.

</specifics>

<deferred>
## Deferred Ideas

- Server-stored AI chat history and audit/history lookup belong to Phase 11, not Phase 10.
- Action proposal schema, preview/diff, approval/cancel flow, and execution boundary belong to Phase 11.
- Low-risk write tools for issues, TODOs, and WBS comments/work memos belong to Phase 12.
- Cross-team/all-team AI querying is excluded from the Phase 10 MVP.

</deferred>

---

*Phase: 10-App AI Chat UI + Read-Only Context Tools*
*Context gathered: 2026-06-02*
