---
phase: 10-app-ai-chat-ui-read-only-context-tools
verified: 2026-06-02T08:06:47Z
status: gaps_found
score: 6/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "AI read tools retrieve project overview, WBS, milestones, issues, TODOs, and WBS work history in a way that grounds provider answers."
    status: failed
    reason: "AiReadContextService builds sanitized summary toolData, but sanitizedProviderContext omits it; AiChatExecutionService prefers that string, so the provider receives generic loaded facts and source counts instead of the actual summary fields."
    artifacts:
      - path: "src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java"
        issue: "Line 137 serializes only facts/source chips/caps; lines 409-427 include summaries in sanitizedContext but those summaries are not serialized into sanitizedProviderContext."
      - path: "src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java"
        issue: "Lines 291-293 prefer sanitizedProviderContext whenever non-blank, dropping sanitizedContext.summaries from the provider request."
      - path: "src/test/java/com/smarterd/application/ai/chat/AiChatExecutionServiceTest.java"
        issue: "Lines 117-124 assert only that readContext exists, not that representative overview/WBS/issue/TODO/history summary fields reach the provider."
    missing:
      - "Serialize sanitized toolData/summaries into the provider context string under the existing cap."
      - "Add a test proving the provider RunCommand contains representative sanitized summary fields, not only generic loaded facts."
  - truth: "Every read tool validates current user, team, project, and resource scope before returning data."
    status: failed
    reason: "Member TODO summary reads aggregate all project TODOs, including private unlinked personal TODOs, and chat accepts selectedResource without validating or applying it."
    artifacts:
      - path: "src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java"
        issue: "Lines 145-164 aggregate every TODO from findByProjectOrderByCreatedAtDescIdDesc(project) after only project membership validation."
      - path: "src/main/java/com/smarterd/domain/pm/todo/repository/ProjectTodoRepository.java"
        issue: "Line 20 exposes all project TODOs by project, not owner-scoped and not limited to linked/shared WBS-visible TODOs."
      - path: "src/main/java/com/smarterd/api/ai/dto/AiChatRequest.java"
        issue: "Lines 20-43 accept selectedResource and carry it into ChatCommand."
      - path: "src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java"
        issue: "Lines 112-120 build ReadCommand without selectedResource; no SelectedResourceValidator is injected or called in the chat path."
    missing:
      - "Restrict member TODO summaries to an explicitly authorized/project-visible aggregate policy, or require a role that can see member-level personal TODO aggregates."
      - "Validate selectedResource through SelectedResourceValidator before read context construction, or remove selectedResource from the chat DTO until resource-specific reads are implemented."
      - "Add tests for unlinked personal TODO exclusion and rejected cross-project/unauthorized selected resources."
  - truth: "Users can select or inherit active team/project context for AI questions."
    status: failed
    reason: "The client enables team-context sends, but the request uses scopeMode 'team' with no projectId; server multi-project resolution requires MULTI_PROJECT or multi-project, so current-team questions fall back to weak-scope confirmation."
    artifacts:
      - path: "client/src/hooks/useAiChatExecution.ts"
        issue: "Lines 147-160 allow any non-weak context, including kind 'team'; lines 163-174 send scopeMode as context.kind."
      - path: "src/main/java/com/smarterd/api/ai/dto/AiChatRequest.java"
        issue: "Lines 58-72 make 'team' currentTeamMode=true but multiProjectMode=false."
      - path: "src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java"
        issue: "Lines 58-64 resolve team scope only when currentTeamMode and multiProjectQuestion are both true; otherwise missing projectId returns WEAK_SCOPE."
      - path: "client/test/unit/ai-chat-execution.test.ts"
        issue: "Lines 85-98 assert team context can send, but no cross-layer test proves the resulting HTTP request resolves server-side."
    missing:
      - "Either disable team sends until a project is selected, or encode team fanout as the server contract expects, for example MULTI_PROJECT."
      - "Add an integration/unit test for a request generated from /teams/:teamId/projects."
  - truth: "Provider/runtime context excludes unnecessary user-identifying values."
    status: failed
    reason: "The shared Phase 9 provider gateway still includes loginId in providerContext and its test asserts that behavior. This is not on the Phase 10 chat path, which uses AiProviderExecutionRunner directly, but it is a real provider-runtime privacy gap in code touched by the phase."
    artifacts:
      - path: "src/main/java/com/smarterd/application/ai/AiExecutionGateway.java"
        issue: "Lines 62-72 include loginId in sanitizedContext."
      - path: "src/test/java/com/smarterd/application/ai/AiExecutionGatewayTest.java"
        issue: "Line 76 asserts providerContext contains loginId."
      - path: "src/main/java/com/smarterd/application/ai/AiProviderExecutionRunner.java"
        issue: "Lines 63-73 pass RunCommand.providerContext directly into AiProviderRequest.context()."
    missing:
      - "Remove loginId from provider prompt context and keep identity only in registry/audit ownership state."
      - "Update tests to assert loginId is absent from providerContext."
  - truth: "Security-sensitive scope resolution cannot silently authorize when dependencies are missing."
    status: partial
    reason: "Production Spring wiring should inject ProjectContextLoader, but AiChatContextResolver exposes a public no-arg constructor and nullable dependencies; if constructed without ProjectContextLoader, single-project scopes resolve without authorization."
    artifacts:
      - path: "src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java"
        issue: "Lines 28-39 allow null ProjectContextLoader; lines 157-160 authorize a single project when the loader is null."
      - path: "src/test/java/com/smarterd/application/ai/chat/AiChatContextResolverTest.java"
        issue: "Line 12 uses the no-arg resolver, so core resolver tests exercise the authorization-bypass construction path."
    missing:
      - "Make ProjectContextLoader a required production dependency and move no-dependency construction to test fixtures or explicit fakes."
re_verification:
  previous_status: none
  previous_score: none
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 10: App AI Chat UI + Read-Only Context Tools Verification Report

**Phase Goal:** A user can ask project-management questions inside Smart-ERD and receive answers grounded in authorized project data.
**Verified:** 2026-06-02T08:06:47Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

The phase is not achieved. The visible chat drawer, typed API path, project-scope response rendering, local persistence, and many tests exist and pass. The goal fails at the data-flow and authorization layers: actual read-tool summary data is not included in the provider context string used by chat execution, member TODO aggregate reads can expose private per-member TODO counts, team-scope sends are enabled but cannot resolve through the server contract, selected resources are accepted but not validated or used, and the shared provider gateway still forwards login IDs to provider context.

## Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | The app exposes an authenticated AI chatbot surface suitable for the local/Electron MVP. | VERIFIED | `AuthenticatedAiChatShell` wraps protected routes in `client/src/App.tsx:29-34`; `AiChatDrawer` provides the right-side dialog; `Header` adds `AiChatTrigger`. |
| 2 | Users can inherit or select active team/project context for AI questions. | FAILED | Project context is supported, but team context is send-enabled while server resolution falls to weak scope. Spot-check produced `canSend: true` and `scopeMode: "team"` with `projectId: null`; server `AiChatRequest.isMultiProjectMode` does not treat `team` as multi-project. |
| 3 | Authenticated clients can send chat questions through a Spring HTTP endpoint and receive structured responses. | VERIFIED | `AiChatController` maps `POST /api/ai/chat`; `aiChatApi` posts to `/ai/chat` through the typed axios module; controller and frontend unit tests pass. |
| 4 | AI read tools retrieve overview, WBS, milestones, issues, TODOs, and history through server-controlled services. | FAILED | Service methods call existing server services, but actual `toolData` summaries are omitted from `sanitizedProviderContext`, which chat prefers before provider execution. Provider answers are therefore not grounded in the detailed read data. |
| 5 | Every read tool validates user, team, project, and resource scope before returning data. | FAILED | Member TODO summary aggregates all project TODOs; selectedResource is accepted but never validated; resolver has a null-dependency authorization fallback. |
| 6 | Read context is summary-first, question-selected, and capped. | VERIFIED | `selectTools`, cap constants, source-chip factory, and `AiReadContextServiceTest` cover tool selection and caps. |
| 7 | Chat responses distinguish confirmed facts from provider/model interpretation. | VERIFIED | `AiChatExecutionService` maps server facts to `confirmedFacts`/`conclusion` and provider answer to `interpretation`; `AiAnswerCard` renders separate sections. |
| 8 | Phase 10 remains read-only and omits action/write controls. | VERIFIED | Provider actions produce `READ_ONLY_PROVIDER_ACTION_REJECTED`; UI grep found no `proposal`, `approval`, `diff`, or provider cancel path in chat components. |
| 9 | Browser-local conversation persistence is login-scoped and sanitized. | VERIFIED | `useAiChatStore` uses `AI_CHAT_CONVERSATION_PREFIX:{loginId}`, caps messages to 50, sanitizes persisted message shape, and unit tests reject secret/raw context fields. |
| 10 | Frontend never calls Codex, Electron IPC, provider runtime, or read tools directly. | VERIFIED | Frontend chat path uses `executeAiChat` and authorized team/project option APIs only; grep found no `codex`, `electron`, or `ipc` matches in chat API/hooks/components. |
| 11 | Provider/runtime context excludes unnecessary user-identifying values. | FAILED | The chat path does not add loginId to provider context, but shared `AiExecutionGateway.sanitizedContext` still includes `loginId` and tests assert it. |

**Score:** 6/11 truths verified

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java` | Server-authoritative scope resolution | PARTIAL | Exists and substantive; wired into chat service. Fails null-dependency authorization fallback and team-scope cross-layer contract. |
| `src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java` | Authorized summary-first read context | FAILED | Exists and wired; calls read services, but provider context drops the actual `summaries` map. |
| `src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java` | Chat orchestration | PARTIAL | Resolves scope, reads context, calls runner, rejects actions. Drops selectedResource and prefers incomplete provider context string. |
| `src/main/java/com/smarterd/api/ai/AiChatController.java` | Authenticated HTTP boundary | VERIFIED | Requires JWT and delegates to execution service. |
| `client/src/api/aiChatApi.ts` | Typed chat client | VERIFIED | Posts typed request through axios module. |
| `client/src/hooks/useAiChatExecution.ts` | Send/stop lifecycle | PARTIAL | Correct API/abort/store plumbing; team context request contract is misaligned. |
| `client/src/stores/useAiChatStore.ts` | Safe local persistence | VERIFIED | Login-scoped storage, sanitization, cap, explicit reset. |
| `client/src/components/ai/*` | Drawer, context bar, composer, answer/source cards | VERIFIED | Wired and substantive; no write/action controls found. |
| `client/e2e/smoke/ai-chat-drawer.spec.ts` | Global drawer smoke | UNCERTAIN | Spec exists and deterministic route mocks exist; local run skipped due missing credentials. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `AiChatController` | `AiChatExecutionService` | JWT subject + DTO | WIRED | `AiChatController.chat()` calls `execute(jwt.getSubject(), request.toCommand())`. |
| `AiChatExecutionService` | `AiChatContextResolver` | scope preflight | WIRED | Resolver runs before read/provider calls. |
| `AiChatExecutionService` | `AiReadContextService` | read context before provider | WIRED | `readContextService.read()` runs before provider execution. |
| `AiChatExecutionService` | `AiProviderExecutionRunner` | Phase 9 provider boundary | WIRED | Uses shared runner directly, not frontend/provider direct calls. |
| `AiReadContextService` | PM read services | authorized reads | PARTIAL | Calls existing services, but member TODO aggregate uses all project TODOs and provider context omits summary payloads. |
| `AiChatRequest` | `SelectedResourceValidator` | resource scope validation | NOT WIRED | selectedResource is accepted and carried into command but no validator is called in chat path. |
| `AiChatDrawer` | `useAiChatStore/useAiRouteContext/useAiChatExecution` | drawer composition | WIRED | Drawer imports and uses all three. |
| `AiChatContextBar` | authorized team/project option APIs | React Query option lookup | WIRED | `useAiChatContextOptions` lazy-loads `fetchTeams` and `fetchProjects`. |
| `Header` | `AiChatTrigger` | authenticated utility rail | WIRED | Header renders trigger when authenticated. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `AiReadContextService` | `toolData` / `sanitizedContext.summaries` | Existing PM services (`getBusinessOverview`, `getWbsItems`, `getMilestones`, `getProjectIssues`, TODO/history services) | Yes inside service map, but not serialized into provider context | FAILED |
| `AiChatExecutionService` | provider `readContext` | `readContext.sanitizedProviderContext()` | No, because non-blank string omits `summaries` | FAILED |
| `ProjectTodoService.getMemberTodoSummaries` | member TODO counts | `findByProjectOrderByCreatedAtDescIdDesc(project)` | Real data, but overbroad/private aggregate | FAILED |
| `useAiChatStore` | persisted messages | login-scoped localStorage key | Yes, sanitized presentation state only | VERIFIED |
| `AiChatDrawer` | messages/context/confirmation candidates | global Zustand store + route context + backend response | Yes for UI state | VERIFIED |
| `AiSourceChips` | response source chips | backend `AiChatResponse.sourceChips` captured at send-time message | Yes for UI rendering | VERIFIED |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend test suite | `./gradlew test --rerun-tasks` | `BUILD SUCCESSFUL in 19s`, 4 tasks executed | PASS |
| Frontend production build | `cd client && npm run build` | Passed; Vite built successfully with existing circular chunk warning | PASS |
| Frontend unit suite | `cd client && npm run test:unit` | Passed; `tests 398`, `pass 398`, `fail 0` | PASS |
| Drawer smoke | `cd client && npx playwright test client/e2e/smoke/ai-chat-drawer.spec.ts` | `1 skipped` because `SMART_ERD_E2E_LOGIN` and `SMART_ERD_E2E_PASSWORD` are absent | SKIP |
| Team-context send contract | Node import from `client/.tmp-test/src/hooks/useAiChatExecution.js` | `canSend: true`, request has `scopeMode: "team"` and `projectId: null` | FAIL |
| Debt markers | `rg "TBD|FIXME|XXX" ...` on Phase 10 critical files | No matches | PASS |
| Probe discovery | `find scripts -path '*/tests/probe-*.sh'` and phase grep | No probes found | SKIP |

## Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| None discovered | `find scripts -path '*/tests/probe-*.sh'` | No probe scripts in repo for this phase | SKIP |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| AI-CHAT-01 | 10-01, 10-03, 10-04, 10-05, 10-06, 10-07 | User can ask Smart-ERD work questions in an in-app chatbot and receive responses. | PARTIAL | UI/API path exists and tests pass; E2E smoke skipped; response grounding gap remains. |
| AI-CHAT-02 | 10-01 through 10-07 | Chatbot clearly uses current team/project context or lets user select context. | BLOCKED | Project context works, but team context is send-enabled and unresolved server-side. |
| AI-READ-01 | 10-01, 10-02, 10-03, 10-06, 10-07 | AI can read business overview/project summary. | PARTIAL | Service calls `getBusinessOverview`, but actual overview summary data is omitted from provider context string. |
| AI-READ-02 | 10-01, 10-02, 10-03, 10-06, 10-07 | AI can read WBS and milestones. | PARTIAL | Service counts WBS/milestones through server services, but provider receives generic facts/counts rather than the summary payload. |
| AI-READ-03 | 10-01, 10-02, 10-03, 10-06, 10-07 | AI can read issues, personal TODOs, WBS history/comments. | BLOCKED | Issue/TODO/history service calls exist, but provider context drops summary payloads; member TODO aggregate privacy gap exists. |
| AI-READ-04 | 10-01, 10-02, 10-03, 10-07 | All read tool calls validate existing user/team/project/resource auth and scope. | BLOCKED | Member TODO aggregate overbroad; selectedResource accepted but not validated; resolver null-dependency fallback can authorize without loader. |

No Phase 10 requirement IDs are orphaned: all six requested IDs appear in plan frontmatter and `REQUIREMENTS.md`.

## Code Review Claim Verification

| Claim | Verdict | Evidence |
|---|---|---|
| CR-01 member TODO aggregate privacy leak | REAL BLOCKER | `ProjectTodoService.getMemberTodoSummaries` aggregates all TODOs from a project-wide repository method, not only owner/shared/project-visible TODOs. |
| CR-02 provider context drops actual read-tool data | REAL BLOCKER | `toolData` is only in `sanitizedContext`; `sanitizedProviderContext` omits it and is preferred by chat execution. |
| CR-03 team scope enabled in client but unresolved server-side | REAL BLOCKER | Module spot-check shows team context can send with `scopeMode: "team"` and `projectId: null`; server does not treat that as multi-project. |
| CR-04 login IDs sent to provider runtime | REAL, INDIRECT | Real for shared `AiExecutionGateway`; false for Phase 10 chat path specifically. Still needs remediation because provider gateway forwards `providerContext` directly. |
| WR-01 selectedResource accepted but unused | REAL BLOCKER | DTO accepts selectedResource; chat execution drops it and never calls `SelectedResourceValidator`. |
| WR-02 resolver no-arg/null dependency authorization fallback | REAL WARNING | Public no-arg resolver resolves single project without authorization if loader is null. Production wiring likely injects the loader, but the security-sensitive fallback exists. |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `AiReadContextService.java` | 137 | Incomplete data-flow serialization | BLOCKER | Provider misses actual sanitized read summaries. |
| `AiChatExecutionService.java` | 291 | Prefers incomplete string provider context | BLOCKER | Drops `sanitizedContext.summaries` before provider invocation. |
| `ProjectTodoService.java` | 148 | Overbroad project-wide TODO aggregate | BLOCKER | Exposes member TODO status/count aggregates for private personal TODOs. |
| `useAiChatExecution.ts` | 157 | Team context send enabled without server contract | BLOCKER | User can submit current-team questions that cannot resolve as current-team reads. |
| `AiChatExecutionService.java` | 112 | selectedResource dropped | BLOCKER | Resource scope is not validated or applied. |
| `AiExecutionGateway.java` | 68 | loginId in provider context | WARNING | Shared provider path sends user identifier to runtime context; not direct Phase 10 chat path. |
| `AiChatContextResolver.java` | 157 | Null-dependency authorization fallback | WARNING | Misconstructed resolver can authorize without `ProjectContextLoader`. |

No unreferenced `TBD`, `FIXME`, or `XXX` markers were found in the Phase 10 critical files scanned.

## Human Verification Required

These do not change the `gaps_found` status, because blockers already exist.

### 1. Drawer Visual Fit

**Test:** Open the authenticated app at desktop and mobile widths; inspect the AI drawer.
**Expected:** Right drawer width, fixed header/context/composer, transcript scrolling, wrapped source chips, focus order, and no overlapping text.
**Why human:** Visual layout quality and focus feel are not fully verified by grep/unit tests.

### 2. Real Credential E2E

**Test:** Set `SMART_ERD_E2E_LOGIN` and `SMART_ERD_E2E_PASSWORD`, start the local app/backend, and run `cd client && npx playwright test client/e2e/smoke/ai-chat-drawer.spec.ts`.
**Expected:** The smoke opens the drawer after login, sends a mocked chat request, renders structured answer/source chips, changes route, and keeps send-time chips.
**Why human:** Current environment lacks the credential variables, so the automated smoke skipped.

### 3. Provider Unavailable UX

**Test:** Run with the local provider unavailable or invalid, open the drawer, and try a project-context question.
**Expected:** Send is disabled or a localized safe error/status copy appears without raw runtime diagnostics.
**Why human:** Unit tests mock provider states; actual local runtime configuration and user-visible copy need integration inspection.

## Deferred Items

No blocking gaps above are clearly deferred by later roadmap phases. Phase 11 covers action proposals, preview/diff, approval, and audit history; Phase 12 covers approved write tools. The current gaps are read-only Phase 10 scope, grounding, and privacy defects.

## Gaps Summary

Phase 10 should not proceed as achieved. The implemented UI shell and API plumbing are substantive, but the phase goal requires grounded, authorized project-data answers. That is not true until the provider receives the actual sanitized read summaries, TODO member aggregates respect privacy boundaries, team context either resolves or is disabled, selected resources are validated or removed from the contract, and the shared provider gateway stops forwarding login IDs.

---

_Verified: 2026-06-02T08:06:47Z_
_Verifier: the agent (gsd-verifier)_
