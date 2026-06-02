---
phase: 10-app-ai-chat-ui-read-only-context-tools
reviewed: 2026-06-02T08:00:44Z
depth: standard
files_reviewed: 54
files_reviewed_list:
  - client/e2e/smoke/ai-chat-drawer.spec.ts
  - client/src/App.tsx
  - client/src/api/aiChatApi.ts
  - client/src/components/ai/AiAnswerCard.tsx
  - client/src/components/ai/AiChatComposer.tsx
  - client/src/components/ai/AiChatContextBar.tsx
  - client/src/components/ai/AiChatDrawer.tsx
  - client/src/components/ai/AiChatTrigger.tsx
  - client/src/components/ai/AiProviderStatusBadge.tsx
  - client/src/components/ai/AiSourceChips.tsx
  - client/src/components/ai/AuthenticatedAiChatShell.tsx
  - client/src/components/layout/Header.tsx
  - client/src/constants/query-keys.ts
  - client/src/constants/storage.ts
  - client/src/hooks/useAiChatContextOptions.ts
  - client/src/hooks/useAiChatExecution.ts
  - client/src/hooks/useAiProviderStatus.ts
  - client/src/hooks/useAiRouteContext.ts
  - client/src/i18n/locales/en/translation.json
  - client/src/i18n/locales/ko/translation.json
  - client/src/stores/useAiChatStore.ts
  - client/src/stores/useAuthStore.ts
  - client/src/types/ai-chat.ts
  - client/src/types/vendor.d.ts
  - client/test/unit/ai-chat-api.test.ts
  - client/test/unit/ai-chat-context.test.ts
  - client/test/unit/ai-chat-drawer.test.ts
  - client/test/unit/ai-chat-execution.test.ts
  - client/test/unit/ai-chat-response-cards.test.ts
  - client/test/unit/ai-chat-store.test.ts
  - client/test/unit/ai-provider-status.test.ts
  - src/main/java/com/smarterd/api/ai/AiChatController.java
  - src/main/java/com/smarterd/api/ai/dto/AiChatRequest.java
  - src/main/java/com/smarterd/api/ai/dto/AiChatResponse.java
  - src/main/java/com/smarterd/api/ai/dto/AiChatSourceChipResponse.java
  - src/main/java/com/smarterd/application/ai/AiExecutionGateway.java
  - src/main/java/com/smarterd/application/ai/AiProviderExecutionRunner.java
  - src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java
  - src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java
  - src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java
  - src/main/java/com/smarterd/application/ai/chat/AiSourceChipFactory.java
  - src/main/java/com/smarterd/domain/common/message/MessageCode.java
  - src/main/java/com/smarterd/domain/pm/todo/repository/ProjectTodoRepository.java
  - src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java
  - src/main/resources/i18n/messages.properties
  - src/main/resources/i18n/messages_ko.properties
  - src/test/java/com/smarterd/api/ai/AiChatControllerMvcTest.java
  - src/test/java/com/smarterd/api/ai/dto/AiChatDtoContractTest.java
  - src/test/java/com/smarterd/application/ai/AiExecutionGatewayCancellationTest.java
  - src/test/java/com/smarterd/application/ai/AiExecutionGatewayTest.java
  - src/test/java/com/smarterd/application/ai/AiProviderExecutionRunnerTest.java
  - src/test/java/com/smarterd/application/ai/chat/AiChatContextResolverTest.java
  - src/test/java/com/smarterd/application/ai/chat/AiChatExecutionServiceTest.java
  - src/test/java/com/smarterd/application/ai/chat/AiReadContextServiceTest.java
findings:
  critical: 4
  warning: 2
  info: 0
  total: 6
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-02T08:00:44Z
**Depth:** standard
**Files Reviewed:** 54
**Status:** issues_found

## Summary

Reviewed the Phase 10 AI chat UI, request/response contracts, read-context services, provider execution path, persistence store, route context handling, and related tests. The implementation has several ship-blocking issues: private personal TODO aggregates can be exposed through AI chat, provider prompts drop the actual sanitized read data, team-scope sends are enabled but cannot resolve server-side, and the provider gateway still sends user login IDs to the AI runtime.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Personal TODO Aggregates Leak Through Member Summary

**Classification:** BLOCKER
**File:** `src/main/java/com/smarterd/domain/pm/todo/service/ProjectTodoService.java:145`
**Issue:** `getMemberTodoSummaries` loads the project for the requester, then iterates every TODO in that project via `findByProjectOrderByCreatedAtDescIdDesc`. That repository method is not owner-scoped and does not require `linkedWbsItem` or shared visibility. `AiReadContextService` calls this path for "member/team TODO" questions, so any project member can make AI chat reveal owner names plus private personal TODO status/count aggregates for all members.
**Fix:**
```java
// Repository: only include TODOs intentionally visible in project context.
@EntityGraph(attributePaths = { "owner", "linkedWbsItem" })
List<ProjectTodo> findByProjectAndLinkedWbsItemIsNotNullOrderByCreatedAtDescIdDesc(Project project);

// Service: aggregate only shared/project-visible TODOs, or require a role that is
// explicitly allowed to see member-level personal TODO aggregates.
for (final var todo : projectTodoRepository.findByProjectAndLinkedWbsItemIsNotNullOrderByCreatedAtDescIdDesc(project)) {
    final var owner = todo.getOwner();
    final var key = new MemberTodoSummaryKey(owner.getId(), owner.getName(), todo.getStatus());
    counts.merge(key, 1L, Long::sum);
}
```
Add a test proving unlinked personal TODOs are excluded from `getMemberTodoSummaries` and from `AiReadContextService.collectMemberTodoSummary`.

### CR-02: Provider Context Drops The Actual Read-Tool Data

**Classification:** BLOCKER
**File:** `src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java:137`
**Issue:** The read service populates `toolData` with sanitized summaries, but `serializeProviderContext` only serializes generic facts, source chips, and caps. `AiChatExecutionService.providerContext` prefers the non-blank `sanitizedProviderContext`, so the provider never sees the actual overview/WBS/issue/TODO/history summary data. It gets strings such as "Project overview summary loaded" and counts, which makes project-data answers effectively unsupported despite the UI presenting them as context-backed.
**Fix:**
```java
private static String serializeProviderContext(
    List<String> facts,
    List<SourceChip> sourceChips,
    Map<String, Object> capMetadata,
    Map<String, Object> toolData
) {
    final var builder = new StringBuilder();
    builder.append("facts:\n");
    facts.forEach(fact -> builder.append("- ").append(fact).append('\n'));
    builder.append("summaries:\n").append(toolData).append('\n');
    builder.append("sources:\n");
    sourceChips.forEach(chip ->
        builder.append("- ").append(chip.projectName()).append(" - ").append(chip.tool()).append(' ').append(chip.count()).append('\n')
    );
    builder.append("caps: ").append(capMetadata);
    return builder.toString();
}
```
Keep the existing character cap, and add a test asserting a provider run command includes representative sanitized summary fields rather than only generic "loaded" facts.

### CR-03: Team Scope Is Send-Enabled In The Client But Cannot Resolve Server-Side

**Classification:** BLOCKER
**File:** `client/src/hooks/useAiChatExecution.ts:157`
**Issue:** The client allows sends for any non-weak context, including `team`. `buildAiChatRequest` then sends `scopeMode: context.kind`, so team routes send `scopeMode: "team"` with no `projectId`. On the server, `AiChatRequest.isMultiProjectMode` returns false for `team`, and `AiChatContextResolver` falls through to `WEAK_SCOPE` whenever `projectId` is null. The result is a visible "Current team" context with an enabled composer that always asks the user to select scope instead of resolving the current team project set.
**Fix:**
```ts
// Option A: do not enable team sends until a project is selected.
if (!input.context || input.context.kind !== 'project') {
  return { canSend: false, reason: 'context-required' };
}

// Option B: if team fanout is intended, send the server contract it expects.
scopeMode: context?.kind === 'team' ? 'MULTI_PROJECT' : context?.kind ?? null,
```
Whichever behavior is intended, align the client and backend contracts and add an integration/unit test that sends from `/teams/:teamId/projects` and verifies the expected backend result.

### CR-04: Login IDs Are Sent To The AI Provider Runtime

**Classification:** BLOCKER
**File:** `src/main/java/com/smarterd/application/ai/AiExecutionGateway.java:62`
**Issue:** `sanitizedContext` includes `"loginId"` and that map is passed directly to `AiProviderExecutionRunner`, which forwards it to `AiProviderRequest.context()`. The login ID is user-identifying data and is not needed for provider reasoning; execution ownership is already tracked in the registry/audit path. The current unit test even asserts that this PII is present in provider context.
**Fix:**
```java
private Map<String, Object> sanitizedContext(ExecuteCommand command) {
    return Map.of(
        "teamId", command.teamId(),
        "projectId", command.projectId(),
        "locale", command.locale() == null ? "" : command.locale()
    );
}
```
Update callers and tests so identity remains in audit/authorization state only, not in provider prompt context.

## Warnings

### WR-01: Chat Accepts Selected Resources But Drops Them Before Validation Or Reading

**Classification:** WARNING
**File:** `src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java:112`
**Issue:** `AiChatRequest` accepts `selectedResource`, `toCommand()` carries it, and `ChatCommand` stores it, but `toReadCommand` and `providerContext` ignore it. Unlike the general provider execution path, chat never calls `SelectedResourceValidator`. This creates a broken API contract: selected issue/TODO/WBS/document context appears supported but is neither validated nor used to narrow read-only context.
**Fix:** Either remove `selectedResource` from the chat request until supported, or inject/use `SelectedResourceValidator` before read-context construction and add resource-specific read commands. Add a test where a selected resource changes the read context, plus a test where a cross-project or unsupported selected resource is rejected.

### WR-02: Resolver Has An Authorization-Bypass Fallback When Dependencies Are Null

**Classification:** WARNING
**File:** `src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java:157`
**Issue:** `AiChatContextResolver` has a public no-arg constructor and nullable security dependencies. If `projectContextLoader` is null, `authorizeSingleProject` returns a resolved project without any authorization check. Spring should inject the loader in normal application wiring, but the class is security-sensitive and currently permits misconfigured construction to silently authorize all single-project scopes.
**Fix:** Make `ProjectContextLoader` a required constructor dependency and update tests to provide a fake or mock loader. If optional construction is needed for isolated unit tests, keep it in test helpers rather than in the production `@Service`.

---

_Reviewed: 2026-06-02T08:00:44Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
