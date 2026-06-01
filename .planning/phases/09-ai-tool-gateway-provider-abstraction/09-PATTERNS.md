# Phase 9 Pattern Map

**Date:** 2026-06-01
**Status:** Complete

## Purpose

Map Phase 9 planned files to existing Smart-ERD implementation patterns so execute-phase can copy local conventions instead of inventing a new style.

## Backend Patterns

| New Area | Closest Existing Analog | Pattern to Reuse |
|----------|-------------------------|------------------|
| `api/ai/AiProviderController.java` | `api/project/ProjectIssueController.java`, `api/project/ProjectTodoController.java` | Thin controller, `@AuthenticationPrincipal Jwt`, DTO records, `ResponseEntity`, service delegation |
| `application/ai/AiExecutionGateway.java` | `application/diagram/command/*UseCase.java`, `domain/pm/common/ProjectContextLoader.java` | Application orchestration can live under `application`; auth/project preflight should use `ProjectContextLoader` |
| `domain/ai/AiExecutionAudit.java` | `domain/pm/history/entity/WorkActivity.java`, `domain/settings/entity/UserSetting.java` | JPA entity with `BaseAuditEntity`/`BaseTimeEntity`, enum string fields, slim indexed table |
| `domain/ai/AiExecutionAuditRepository.java` | `domain/pm/history/repository/WorkActivityRepository.java` | Spring Data `JpaRepository` with explicit finder if needed |
| `config/ai/AiProperties.java` | `config/security/AuthSecurityProperties.java`, `config/websocket/WebSocketProperties.java` | `@ConfigurationProperties(prefix = "smart-erd.ai")`, enabled through config class |
| `application/ai/provider/CodexProcessRunner.java` | no direct analog | Keep as isolated boundary with unit tests; do not leak into domain service |
| `application/ai/validation/ProviderOutputValidator.java` | controller DTO validation + service invariant tests | Jackson mapping + Bean Validation + explicit action draft validator |
| `src/main/resources/db/migration/V20260601_01__phase9_ai_execution_audit.sql` | `V20260528_01__user_settings.sql`, `V20260428_03__phase8_project_todos.sql` | `CREATE TABLE IF NOT EXISTS`, `TIMESTAMPTZ`, explicit indexes, metadata-only fields |

## Frontend Patterns

| New Area | Closest Existing Analog | Pattern to Reuse |
|----------|-------------------------|------------------|
| `client/src/api/aiProviderApi.ts` | `client/src/api/issuesApi.ts`, `client/src/api/projectTodoApi.ts` | Domain API module, relative paths against `axiosInstance`, typed functions |
| `client/src/types/ai-provider.ts` | `client/src/types/issues.ts`, `client/src/types/project-todo.ts` | exported string union enums and payload/response interfaces |
| `client/src/constants/query-keys.ts` | existing `queryKeys.*` groups | add `aiProvider.status()` and `aiProvider.execution(executionId)` hierarchy |
| `client/src/hooks/useAiProviderStatus.ts` | `client/src/hooks/useTeamRole.ts` | small React Query hook hiding query key and API function |
| `client/src/components/ai/AiProviderStatusBadge.tsx` | workspace status/empty surfaces and badge styles | compact operational badge, i18n labels, no chat UI |
| `client/src/i18n/locales/{ko,en}/translation.json` | existing `workspace.status`, `projectTodo.status` keys | all visible copy under `aiProvider.*` |

## Security Patterns

- Use `ProjectContextLoader.load(loginId, teamId, projectId, false)` for read-only AI execution preflight.
- Keep write/editable checks out of Phase 9 because no write execution occurs.
- Add new `MessageCode` entries only for request/auth/resource failures that should use the existing HTTP exception path.
- Provider execution failures can stay inside AI response DTO as redacted provider errors.
- Never put Codex CLI details in PM domain services.

## Test Patterns

| Test | Existing Analog | Notes |
|------|-----------------|-------|
| `AiProviderControllerMvcTest` | `ProjectIssueControllerMvcTest`, `UserSettingControllerMvcTest` | standalone MockMvc, custom Jwt resolver, mock gateway |
| gateway lifecycle tests | domain service tests with Mockito | fake provider/runner, assert transitions and audit calls |
| validator tests | service invariant tests | invalid JSON, invalid DTO, unsafe action drafts |
| process runner tests | no direct analog | inject fake process launcher abstraction to avoid spawning real Codex |
| local Codex smoke | separate opt-in test/profile | excluded from default CI/general test runs |

## Known Gaps

- No existing Java process runner abstraction. Plan must introduce a small seam (`ProcessLauncher` or equivalent) so tests can verify argv/env/cwd without launching a real process.
- No existing frontend React component unit test harness. Phase 9 frontend verification should use TypeScript build plus optional later browser smoke.
- No existing AI audit domain. Keep table and entity minimal to reduce future migration churn.
