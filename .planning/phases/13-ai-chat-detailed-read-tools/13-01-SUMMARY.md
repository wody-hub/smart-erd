# 13-01-SUMMARY: Detailed Provider Read Context and Grounding Prompt Guardrails

## Status

Complete.

## Implemented

- Expanded `AiReadContextService` provider context from count-only summaries to capped detailed rows for:
  - WBS items
  - Milestones
  - Project issues
  - Current-user TODOs
  - WBS comments and activities
- Preserved member TODO aggregate-only privacy behavior.
- Added row/field caps, provider context truncation markers, and explicit cap metadata.
- Added WBS history scan metadata so partial WBS scans are not reported as complete data.
- Updated active Local Codex provider prompt guardrails for readContext grounding, prompt-injection resistance, caps, missing details, and login ID/stdout/stderr privacy.
- Added backend tests for detailed rows, history truncation, owner aggregation caps, provider context truncation, and facts/sources overflow.

## Verification

- `./gradlew test --tests "com.smarterd.application.ai.chat.AiReadContextServiceTest"` — passed
- `./gradlew test --tests "com.smarterd.application.ai.chat.AiReadContextServiceTest" --tests "com.smarterd.application.ai.chat.AiChatExecutionServiceTest"` — passed
- `./gradlew test --tests "com.smarterd.domain.pm.todo.service.ProjectTodoServiceTest" --tests "com.smarterd.domain.pm.wbs.service.WbsServiceTest" --tests "com.smarterd.domain.pm.issue.service.ProjectIssueServiceTest" --tests "com.smarterd.domain.pm.milestone.service.MilestoneServiceTest" --tests "com.smarterd.domain.pm.history.service.WorkItemHistoryServiceTest"` — passed
- `./gradlew test` — passed
- `git diff --check` — passed

## Review Outcome

Initial code review found provider context truncation, history scan completeness, member TODO owner cap, and prompt activation issues. All were fixed and re-reviewed.

Final targeted review result: no blocking findings and no warnings.
