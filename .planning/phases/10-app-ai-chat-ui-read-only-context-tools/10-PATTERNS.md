# Phase 10: App AI Chat UI + Read-Only Context Tools - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 36 target files
**Analogs found:** 36 / 36

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/java/com/smarterd/api/ai/AiChatController.java` | controller | request-response | `src/main/java/com/smarterd/api/ai/AiProviderController.java` | exact |
| `src/main/java/com/smarterd/api/ai/dto/AiChatRequest.java` | model | request-response | `src/main/java/com/smarterd/api/ai/dto/AiProviderExecuteRequest.java` | exact |
| `src/main/java/com/smarterd/api/ai/dto/AiChatResponse.java` | model | request-response | `src/main/java/com/smarterd/api/ai/dto/AiProviderExecuteResponse.java` | role-match |
| `src/main/java/com/smarterd/api/ai/dto/AiChatSourceChipResponse.java` | model | transform | `src/main/java/com/smarterd/api/project/dto/issue/ProjectIssueListResponse.java` | role-match |
| `src/main/java/com/smarterd/application/ai/chat/AiChatExecutionService.java` | service | request-response | `src/main/java/com/smarterd/application/ai/AiExecutionGateway.java` | exact |
| `src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java` | service | request-response | `src/main/java/com/smarterd/domain/pm/common/ProjectContextLoader.java` | partial |
| `src/main/java/com/smarterd/application/ai/chat/AiReadContextService.java` | service | CRUD | `src/main/java/com/smarterd/domain/pm/issue/service/ProjectIssueService.java` | role-match |
| `src/main/java/com/smarterd/application/ai/chat/AiSourceChipFactory.java` | service | transform | `src/main/java/com/smarterd/api/project/dto/issue/ProjectIssueSummaryResponse.java` | partial |
| `src/main/java/com/smarterd/application/ai/provider/AiProviderResult.java` | model | request-response | `src/main/java/com/smarterd/application/ai/provider/AiProviderResult.java` | reference-only exclusion |
| `src/main/resources/ai/provider-output.schema.json` | config | transform | `src/main/resources/ai/provider-output.schema.json` | reference-only exclusion |
| `src/main/java/com/smarterd/domain/common/message/MessageCode.java` | config | transform | `src/main/java/com/smarterd/domain/common/message/MessageCode.java` | existing-modification |
| `src/main/resources/i18n/messages.properties` | config | transform | `src/main/resources/i18n/messages.properties` | existing-modification |
| `src/main/resources/i18n/messages_ko.properties` | config | transform | `src/main/resources/i18n/messages_ko.properties` | existing-modification |
| `client/src/api/aiChatApi.ts` | service | request-response | `client/src/api/aiProviderApi.ts` | exact |
| `client/src/types/ai-chat.ts` | model | transform | `client/src/types/ai-provider.ts` | exact |
| `client/src/hooks/useAiChatExecution.ts` | hook | request-response | `client/src/hooks/useAiProviderStatus.ts` | role-match |
| `client/src/hooks/useAiRouteContext.ts` | hook | request-response | `client/src/pages/project/ProjectWbsPage.tsx` | partial |
| `client/src/stores/useAiChatStore.ts` | store | event-driven | `client/src/hooks/useRecentProjectContext.ts` | partial |
| `client/src/components/ai/AiChatDrawer.tsx` | component | event-driven | `client/src/components/ui/dialog.tsx` | role-match |
| `client/src/components/ai/AiChatTrigger.tsx` | component | event-driven | `client/src/components/ai/AiProviderStatusBadge.tsx` | role-match |
| `client/src/components/ai/AiContextBar.tsx` | component | request-response | `client/src/components/ui/command.tsx` | role-match |
| `client/src/components/ai/AiResponseCards.tsx` | component | transform | `client/src/components/ai/AiProviderStatusBadge.tsx` | partial |
| `client/src/App.tsx` | route | request-response | `client/src/App.tsx` | existing-modification |
| `client/src/components/layout/Header.tsx` | component | event-driven | `client/src/components/layout/Header.tsx` | existing-modification |
| `client/src/constants/query-keys.ts` | config | transform | `client/src/constants/query-keys.ts` | existing-modification |
| `client/src/constants/storage.ts` | config | transform | `client/src/constants/storage.ts` | existing-modification |
| `client/src/i18n/locales/en/translation.json` | config | transform | `client/src/i18n/locales/en/translation.json` | existing-modification |
| `client/src/i18n/locales/ko/translation.json` | config | transform | `client/src/i18n/locales/ko/translation.json` | existing-modification |
| `src/test/java/com/smarterd/api/ai/AiChatControllerMvcTest.java` | test | request-response | `src/test/java/com/smarterd/api/ai/AiProviderControllerMvcTest.java` | exact |
| `src/test/java/com/smarterd/application/ai/chat/AiChatExecutionServiceTest.java` | test | request-response | `src/test/java/com/smarterd/application/ai/AiExecutionGatewayTest.java` | exact |
| `src/test/java/com/smarterd/application/ai/chat/AiChatContextResolverTest.java` | test | request-response | `src/test/java/com/smarterd/application/ai/AiExecutionGatewayTest.java` | role-match |
| `src/test/java/com/smarterd/application/ai/chat/AiReadContextServiceTest.java` | test | CRUD | `src/test/java/com/smarterd/domain/pm/issue/service/ProjectIssueServiceTest.java` | role-match |
| `client/test/unit/ai-chat-store.test.ts` | test | event-driven | `client/test/unit/diagram-code-draft.test.ts` | role-match |
| `client/test/unit/ai-chat-context.test.ts` | test | request-response | `client/test/unit/recent-project-context.test.ts` | role-match |
| `client/test/unit/ai-chat-response-cards.test.ts` | test | transform | `client/test/unit/ai-provider-status.test.ts` | role-match |
| `client/e2e/smoke/ai-chat-drawer.spec.ts` | test | request-response | `client/e2e/smoke/diagram-loading.spec.ts` | role-match |

## Revision Reconciliation

- `src/main/java/com/smarterd/application/ai/provider/AiProviderResult.java` and `src/main/resources/ai/provider-output.schema.json` are reference-only for Phase 10. Plans 10-01 and 10-03 now require `AiChatExecutionServiceTest` plus `AiChatExecutionService` assembler logic that uses the existing Phase 9 `ProviderOutputValidator`; they do not replace the provider schema globally.
- Chat response sections are produced as follows: `confirmedFacts`, `sourceChips`, `context`, and `confirmationCandidates` come from `AiReadContextService`/`AiChatContextResolver`; provider `answer` maps only to `interpretation`; `conclusion` is generated by the server assembler from the first confirmed fact/read summary or localized safe fallback; `needsConfirmation` comes only from resolver/read-service gaps; non-empty provider actions are rejected or omitted from chat responses.

## Pattern Assignments

### Backend Chat HTTP Boundary

**Applies to:** `AiChatController.java`, `AiChatRequest.java`, `AiChatResponse.java`

**Analog:** `src/main/java/com/smarterd/api/ai/AiProviderController.java`

**Imports and annotations pattern** (lines 3-25):
```java
import com.smarterd.api.ai.dto.AiProviderExecuteRequest;
import com.smarterd.api.ai.dto.AiProviderExecuteResponse;
import com.smarterd.application.ai.AiExecutionGateway;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/provider")
@RequiredArgsConstructor
```

**Controller method pattern** (lines 35-40):
```java
@PostMapping("/execute")
public ResponseEntity<AiProviderExecuteResponse> execute(
    @AuthenticationPrincipal Jwt jwt,
    @Valid @RequestBody AiProviderExecuteRequest request
) {
    return ResponseEntity.ok(AiProviderExecuteResponse.from(aiExecutionGateway.execute(jwt.getSubject(), request.toCommand())));
}
```

**Request DTO validation + command mapping** from `AiProviderExecuteRequest.java` (lines 9-24):
```java
public record AiProviderExecuteRequest(
    @NotNull Long teamId,
    @NotNull Long projectId,
    @NotBlank @Size(max = 4000) String userMessage,
    @Size(max = 20) String locale,
    @Valid AiSelectedResourceRequest selectedResource
) {
    public AiExecutionGateway.ExecuteCommand toCommand() {
        return new AiExecutionGateway.ExecuteCommand(
            teamId,
            projectId,
            userMessage,
            locale,
            selectedResource == null ? null : selectedResource.toCommand()
        );
    }
}
```

**Response DTO assembly pattern** from `AiProviderExecuteResponse.java` (lines 7-34):
```java
public record AiProviderExecuteResponse(
    String executionId,
    String provider,
    String promptVersion,
    String status,
    Instant createdAt,
    Instant startedAt,
    Instant completedAt,
    Long durationMs,
    String answer,
    List<AiActionDraftResponse> actions,
    AiProviderErrorResponse error
) {
    public static AiProviderExecuteResponse from(AiExecutionGateway.AiExecutionView view) {
        return new AiProviderExecuteResponse(
            view.executionId(),
            view.provider(),
            view.promptVersion(),
            view.state().name(),
            view.createdAt(),
            view.startedAt(),
            view.completedAt(),
            view.durationMs(),
            view.answer(),
            view.actions().stream().map(AiActionDraftResponse::from).toList(),
            AiProviderErrorResponse.from(view.error())
        );
    }
}
```

**Planner notes:**
- Use a new chat path such as `/api/ai/chat`, not `/api/ai/provider/execute`, because Phase 10 must support weak context, manual context, confirmation responses, and current-team multi-project reads.
- Keep the controller thin: validate DTO, pass `jwt.getSubject()` to application service, map view/result to response DTO.
- Use Bean Validation annotations with i18n message keys for the chat message and optional scope fields.

---

### Backend Chat Orchestration

**Applies to:** `AiChatExecutionService.java`, chat response assembly, provider gateway integration

**Analog:** `src/main/java/com/smarterd/application/ai/AiExecutionGateway.java`

**Service and dependency pattern** (lines 18-33):
```java
/**
 * Provider-independent AI execution gateway.
 */
@Service
@RequiredArgsConstructor
public class AiExecutionGateway {

    public static final String PROMPT_VERSION = "provider-response-v1";

    private final ProjectContextLoader projectContextLoader;
    private final SelectedResourceValidator selectedResourceValidator;
    private final AiExecutionAuditService auditService;
    private final AiProvider aiProvider;
    private final AiExecutionRegistry executionRegistry;
    private final ProviderOutputValidator outputValidator;
```

**Authorization before provider execution** (lines 44-72):
```java
@Transactional
public AiExecutionView execute(String loginId, ExecuteCommand command) {
    final var context = projectContextLoader.load(loginId, command.teamId(), command.projectId(), false);
    selectedResourceValidator.validate(loginId, context.project(), command.selectedResource());

    final var providerStatus = aiProvider.status();
    final var execution = executionRegistry.create(
        loginId,
        command.teamId(),
        command.projectId(),
        providerStatus.provider(),
        PROMPT_VERSION
    );
    executionRegistry.registerCancelHandler(execution.executionId(), () -> aiProvider.cancel(execution.executionId()));
    executionRegistry.markRunning(execution.executionId());

    AiProviderResult result;
    try {
        result = outputValidator.validate(
            aiProvider.execute(
                new AiProviderRequest(
                    execution.executionId(),
                    PROMPT_VERSION,
                    command.userMessage(),
                    command.locale(),
                    sanitizedContext(loginId, command)
                )
            )
        );
```

**Provider failure containment** (lines 73-95):
```java
} catch (BusinessException ex) {
    result = AiProviderResult.failed(
        new AiProviderError(
            "OUTPUT_VALIDATION_FAILED",
            "Provider output validation failed",
            "The AI provider returned invalid structured output.",
            false
        )
    );
} catch (RuntimeException ex) {
    result = AiProviderResult.failed(
        new AiProviderError("PROVIDER_FAILED", "Provider execution failed", "The AI provider failed safely.", true)
    );
}

if (result.error() == null) {
    executionRegistry.markSucceeded(execution.executionId(), result);
} else {
    executionRegistry.markFailed(execution.executionId(), result);
}
final var completed = executionRegistry.get(execution.executionId(), loginId);
auditService.record(completed);
return AiExecutionView.from(completed);
```

**Sanitized provider context pattern** (lines 108-119):
```java
private Map<String, Object> sanitizedContext(String loginId, ExecuteCommand command) {
    return Map.of(
        "teamId",
        command.teamId(),
        "projectId",
        command.projectId(),
        "loginId",
        loginId,
        "locale",
        command.locale() == null ? "" : command.locale()
    );
}
```

**Planner notes:**
- In Phase 10, `AiChatExecutionService` should resolve scope and collect authorized read context before calling the provider boundary.
- Keep the provider request context sanitized. Add summary facts/source metadata, never raw tokens, cookies, environment values, or arbitrary backend config.
- If scope is missing or ambiguous, return a confirmation-style `AiChatResponse` before calling `aiProvider.execute`.

---

### Backend Scope and Authorization

**Applies to:** `AiChatContextResolver.java`, `AiReadContextService.java`, selected-resource reads

**Analogs:** `ProjectContextLoader.java`, `SelectedResourceValidator.java`, `ProjectTodoAccessService.java`

**Project context membership check** from `ProjectContextLoader.java` (lines 33-44):
```java
public ProjectContext load(String loginId, Long teamId, Long projectId, boolean editable) {
    final var user = authService.findUserByLoginId(loginId);
    final var team = teamService.findTeamById(teamId);
    if (editable) {
        teamService.verifyEditable(team, user);
    } else {
        teamService.verifyMembership(team, user);
    }

    final var project = projectService.findProjectById(projectId);
    projectService.verifyProjectBelongsToTeam(project, teamId);
    return new ProjectContext(team, project);
}
```

**Selected resource validation** from `SelectedResourceValidator.java` (lines 29-57):
```java
public void validate(String loginId, Project project, AiSelectedResource selectedResource) {
    if (selectedResource == null) {
        return;
    }
    final var id = Objects.requireNonNull(selectedResource.id());
    final var type = selectedResource.type() == null ? "" : selectedResource.type().toUpperCase(Locale.ROOT);
    switch (type) {
        case "PROJECT_ISSUE", "ISSUE" -> projectIssueRepository
            .findByProjectAndId(project, id)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT_ISSUE.code(), id));
        case "PROJECT_TODO", "TODO" -> {
            final var todo = projectTodoRepository
                .findByProjectAndId(project, id)
                .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT_TODO.code(), id));
            if (!Objects.equals(todo.getOwner().getLoginId(), loginId)) {
                throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_PROJECT_TODO_OWNER_ONLY.code());
            }
        }
        case "WBS_ITEM", "WBS" -> wbsItemRepository
            .findByProjectAndId(project, id)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), id));
        case "DOCUMENT", "DIAGRAM" -> diagramRepository
            .findByProjectAndIdAndDeletedAtIsNull(project, id)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), id));
        default -> throw new BusinessException(
            MessageCode.ERROR_BUSINESS_AI_SELECTED_RESOURCE_UNSUPPORTED.code(),
            selectedResource.type()
        );
    }
}
```

**Personal TODO owner boundary** from `ProjectTodoAccessService.java` (lines 41-46, 69-72):
```java
ProjectTodo findOwnedTodo(String loginId, Project project, Long todoId) {
    final var todo = projectTodoRepository
        .findByProjectAndId(project, Objects.requireNonNull(todoId))
        .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_PROJECT_TODO.code(), todoId));
    ensureOwner(todo, loginId);
    return todo;
}

private void ensureOwner(ProjectTodo todo, String loginId) {
    if (!Objects.equals(todo.getOwner().getLoginId(), loginId)) {
        throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_PROJECT_TODO_OWNER_ONLY.code());
    }
}
```

**Planner notes:**
- Treat route/manual context as untrusted input. Load the team/project on the server and verify membership for every read.
- Default TODO reads must use current-user ownership. Member-wide TODO summaries need an explicit authorization rule before querying another user.
- Use localized domain exceptions, not raw `IllegalArgumentException`, for denied/unsupported scope.

---

### Backend Read Context Summaries

**Applies to:** `AiReadContextService.java`

**Analogs:** `ProjectService.java`, `WbsService.java`, `MilestoneService.java`, `ProjectIssueService.java`, `ProjectTodoService.java`, `WorkItemHistoryService.java`

**Project/business overview read** from `ProjectService.java` (lines 154-162, 260-276):
```java
public BusinessOverviewResult getBusinessOverview(String loginId, Long teamId, Long projectId) {
    final var user = authService.findUserByLoginId(loginId);
    final var team = teamService.findTeamById(teamId);
    teamService.verifyMembership(team, user);

    final var project = findProjectById(projectId);
    verifyProjectBelongsToTeam(project, teamId);

    return toBusinessOverviewResult(project, team);
}

private BusinessOverviewResult toBusinessOverviewResult(Project project, Team team) {
    final var memberCount = teamService.countMembers(team);
    final var documentCount = diagramRepository.countByProjectAndDeletedAtIsNull(project);
    final var progressRate = projectProgressProvider.getAverageProgressRate(project);
    return new BusinessOverviewResult(
        project.getId(),
        project.getName(),
        project.getClientCompany(),
        project.getContractorCompany(),
        project.getContractAmount(),
        project.getProjectStartDate(),
        project.getProjectEndDate(),
        project.getProjectScope(),
        memberCount,
        documentCount,
        progressRate
    );
}
```

**WBS read and schedule metrics** from `WbsService.java` (lines 60-85, 397-431):
```java
public List<WbsItemResult> getWbsItems(String loginId, Long teamId, Long projectId) {
    final var context = projectContextLoader.load(loginId, teamId, projectId, false);
    final var items = wbsItemRepository.findByProjectWithRelations(context.project());
    final var dependencies = wbsDependencyRepository.findByProjectWithRelations(context.project());
    final Map<Long, List<Long>> predecessorIdsByItemId = new HashMap<>();
    final Map<Long, List<Long>> successorIdsByItemId = new HashMap<>();

    for (final var dependency : dependencies) {
        successorIdsByItemId
            .computeIfAbsent(dependency.getPredecessor().getId(), (ignored) -> new ArrayList<>())
            .add(dependency.getSuccessor().getId());
        predecessorIdsByItemId
            .computeIfAbsent(dependency.getSuccessor().getId(), (ignored) -> new ArrayList<>())
            .add(dependency.getPredecessor().getId());
    }

    return orderAsTree(items)
        .stream()
        .map((item) ->
            toResult(
                item,
                predecessorIdsByItemId.getOrDefault(item.getId(), List.of()),
                successorIdsByItemId.getOrDefault(item.getId(), List.of())
            )
        )
        .toList();
}
```

```java
private WbsItemResult toResult(WbsItem item, List<Long> predecessorIds, List<Long> successorIds) {
    final var assignee = item.getAssignee();
    final var milestone = item.getMilestone();
    final var scheduleMetrics = wbsScheduleMetricsService.calculate(
        item.getStartDate(),
        item.getEndDate(),
        item.getActualStartDate(),
        item.getActualEndDate(),
        item.getProgressRate()
    );
    return new WbsItemResult(
        item.getId(),
        item.getParent() == null ? null : item.getParent().getId(),
        item.getName(),
        item.getDepth(),
        item.getSortOrder(),
        assignee == null ? null : assignee.getId(),
        assignee == null ? null : assignee.getName(),
        item.getStartDate(),
        item.getEndDate(),
        item.getActualStartDate(),
        item.getActualEndDate(),
        item.getProgressRate(),
        scheduleMetrics.plannedProgressRate(),
        scheduleMetrics.progressVarianceRate(),
        scheduleMetrics.startVarianceDays(),
        scheduleMetrics.endVarianceDays(),
```

**Milestone summary read** from `MilestoneService.java` (lines 52-76):
```java
public List<MilestoneResult> getMilestones(String loginId, Long teamId, Long projectId) {
    final var context = projectContextLoader.load(loginId, teamId, projectId, false);

    final var milestones = milestoneRepository.findByProjectOrderBySortOrder(context.project());
    final var dependencyCounts = aggregateDependencyCounts(context.project());
    final var aggregates = wbsItemRepository.aggregateProgressByMilestone(context.project());

    final var today = LocalDate.now(clock);
    final var nextWaveMilestoneId = resolveNextWaveMilestoneId(milestones, aggregates);
    return milestones
        .stream()
        .map((milestone) -> {
            final var aggregate = aggregates.getOrDefault(milestone.getId(), MilestoneProgressAggregate.EMPTY);
            final var dependencyCount = dependencyCounts.getOrDefault(milestone.getId(), MilestoneDependencyCount.EMPTY);
            final var isDelayed = milestone.getTargetDate().isBefore(today) && aggregate.averageRate() < 100;
            return toResult(
                milestone,
                aggregate,
                isDelayed,
                dependencyCount.inboundCount(),
                dependencyCount.outboundCount(),
                Objects.equals(milestone.getId(), nextWaveMilestoneId) ? aggregate.count() : 0L
            );
        })
        .toList();
}
```

**Issues summary read** from `ProjectIssueService.java` (lines 52-64, 350-370):
```java
public List<ProjectIssueResult> getProjectIssues(
    String loginId,
    Long teamId,
    Long projectId,
    @Nullable ProjectIssueQuery query
) {
    final var context = projectContextLoader.load(loginId, teamId, projectId, false);
    return projectIssueRepository
        .findByProjectAndQuery(context.project(), ProjectIssueQuery.normalize(query))
        .stream()
        .map(this::toResult)
        .toList();
}

public record ProjectIssueQuery(
    List<ProjectIssueStatus> statuses,
    List<ProjectIssuePriority> priorities,
    List<Long> assigneeIds,
    boolean includeUnassigned
) {
    public static ProjectIssueQuery normalize(@Nullable ProjectIssueQuery query) {
        return query == null ? new ProjectIssueQuery(List.of(), List.of(), List.of(), false) : query;
    }

    public ProjectIssueQuery {
        statuses = statuses == null ? List.of() : List.copyOf(new LinkedHashSet<>(statuses));
        priorities = priorities == null ? List.of() : List.copyOf(new LinkedHashSet<>(priorities));
        assigneeIds = assigneeIds == null ? List.of() : List.copyOf(new LinkedHashSet<>(assigneeIds));
    }
}
```

**Current-user TODO read** from `ProjectTodoService.java` (lines 34-47):
```java
public List<ProjectTodoResult> getProjectTodos(String loginId, Long teamId, Long projectId) {
    final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
    final var owner = projectTodoAccessService.findUserByLoginId(loginId);
    return projectTodoRepository
        .findByProjectAndOwnerOrderByCreatedAtDescIdDesc(project, owner)
        .stream()
        .map(projectTodoMapper::toProjectTodoResult)
        .toList();
}

public ProjectTodoResult getProjectTodo(String loginId, Long teamId, Long projectId, Long todoId) {
    final var project = projectTodoAccessService.loadProject(loginId, teamId, projectId);
    final var todo = projectTodoAccessService.findOwnedTodo(loginId, project, todoId);
    return projectTodoMapper.toProjectTodoResult(todo);
}
```

**WBS comments/activity read** from `WorkItemHistoryService.java` (lines 46-84):
```java
public List<WorkCommentResult> getWbsComments(String loginId, Long teamId, Long projectId, Long wbsItemId) {
    final var context = projectContextLoader.load(loginId, teamId, projectId, false);
    ensureTargetExists(context.project(), WorkTargetType.WBS, wbsItemId);
    final var comments = workCommentRepository.findByProjectAndTargetTypeAndTargetIdOrderByCreatedAtAscIdAsc(
        context.project(),
        WorkTargetType.WBS,
        wbsItemId
    );
    final var actorNames = resolveActorNames(comments.stream().map(WorkComment::getCreatedBy).toList());
    return comments.stream().map((comment) -> toCommentResult(comment, actorNames)).toList();
}

public List<WorkActivityResult> getWbsActivities(String loginId, Long teamId, Long projectId, Long wbsItemId) {
    final var context = projectContextLoader.load(loginId, teamId, projectId, false);
    ensureTargetExists(context.project(), WorkTargetType.WBS, wbsItemId);
    final var activities = workActivityRepository.findByProjectAndTargetTypeAndTargetIdOrderByCreatedAtDescIdDesc(
        context.project(),
        WorkTargetType.WBS,
        wbsItemId
    );
    final var actorNames = resolveActorNames(activities.stream().map(WorkActivity::getCreatedBy).toList());
    return activities.stream().map((activity) -> toActivityResult(activity, actorNames)).toList();
}
```

**Planner notes:**
- Read tools should call existing services or repositories through an application service; do not call controllers from services.
- Build summary-first facts in typed Java: counts, distributions, delayed/incomplete/unassigned/recent values.
- Fetch detailed rows only for explicit detail questions or follow-ups.

---

### Backend Source Chips and Response Sections

**Applies to:** `AiSourceChipFactory.java`, `AiChatSourceChipResponse.java`, `AiChatResponse.java`

**Analogs:** `ProjectIssueListResponse.java`, `ProjectIssueSummaryResponse.java`, `provider-output.schema.json`

**List + summary response shape** from `ProjectIssueListResponse.java` (lines 8-20):
```java
public record ProjectIssueListResponse(
    List<ProjectIssueResponse> items,
    ProjectIssueSummaryResponse summary
) {
    /**
     * 이슈 목록 응답 DTO를 생성한다.
     *
     * @param items 이슈 목록
     * @return 목록 + 요약 응답
     */
    public static ProjectIssueListResponse from(List<ProjectIssueResponse> items) {
        return new ProjectIssueListResponse(items, ProjectIssueSummaryResponse.from(items));
    }
}
```

**Summary computation pattern** from `ProjectIssueSummaryResponse.java` (lines 9-26):
```java
public record ProjectIssueSummaryResponse(
    long totalCount,
    long registeredCount,
    long inProgressCount,
    long doneCount
) {
    public static ProjectIssueSummaryResponse from(List<ProjectIssueResponse> items) {
        final var registeredCount = items.stream().filter(item -> item.status() == ProjectIssueStatus.REGISTERED).count();
        final var inProgressCount = items.stream().filter(item -> item.status() == ProjectIssueStatus.IN_PROGRESS).count();
        final var doneCount = items.stream().filter(item -> item.status() == ProjectIssueStatus.DONE).count();
        return new ProjectIssueSummaryResponse(items.size(), registeredCount, inProgressCount, doneCount);
    }
}
```

**Current provider result shape** from `AiProviderResult.java` (lines 14-29):
```java
public record AiProviderResult(
    @Size(max = 4000) String answer,
    @Valid List<AiActionDraft> actions,
    @Valid AiProviderError error
) {
    public AiProviderResult {
        actions = actions == null ? List.of() : List.copyOf(actions);
    }

    public static AiProviderResult answer(String answer) {
        return new AiProviderResult(answer, List.of(), null);
    }

    public static AiProviderResult failed(AiProviderError error) {
        return new AiProviderResult(null, List.of(), error);
    }
}
```

**Schema validation pattern** from `provider-output.schema.json` (lines 1-8, 28-40):
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "answer": {
      "type": ["string", "null"],
      "maxLength": 4000
    },
```

```json
    "error": {
      "type": ["object", "null"],
      "additionalProperties": false,
      "properties": {
        "type": { "type": "string", "minLength": 1, "maxLength": 80 },
        "title": { "type": "string", "minLength": 1, "maxLength": 200 },
        "detail": { "type": "string", "minLength": 1, "maxLength": 500 },
        "retryable": { "type": "boolean" }
      },
      "required": ["type", "title", "detail", "retryable"]
    }
  },
  "required": ["actions"]
}
```

**Planner notes:**
- Source chips must come from the read-tool result metadata, not model prose. Shape them as backend-owned DTOs with `scopeLabel`, `tool`, and `count`.
- For facts / interpretation / needs-confirmation cards, assemble chat sections after the existing provider output is validated. Do not parse markdown headings to recover sections and do not replace the Phase 9 provider schema globally.
- Preserve Phase 9 provider compatibility by leaving `AiProviderResult` and `provider-output.schema.json` as reference-only inputs for Phase 10; the chat-specific section contract belongs in `AiChatExecutionService`, `AiChatResponse`, and frontend `AiChatResponse` types.

---

### Backend Errors and i18n

**Applies to:** `MessageCode.java`, `messages.properties`, `messages_ko.properties`, backend validation messages

**Analogs:** `MessageCode.java`, `GlobalExceptionHandler.java`, i18n message files

**Message code enum pattern** from `MessageCode.java` (lines 7-15, 67-69, 121-123):
```java
ERROR_AUTH_BAD_CREDENTIALS("error.auth.bad-credentials"),
ERROR_AUTH_LOGIN_RATE_LIMITED("error.auth.login-rate-limited"),
ERROR_ACCESS_DENIED_NOT_ADMIN("error.access-denied.not-admin"),
ERROR_ACCESS_DENIED_NOT_MEMBER("error.access-denied.not-member"),
ERROR_ACCESS_DENIED_PROJECT_TODO_OWNER_ONLY("error.access-denied.project-todo-owner-only"),
ERROR_ACCESS_DENIED_VIEWER_READONLY("error.access-denied.viewer-readonly"),
ERROR_ACCESS_DENIED_DIAGRAM_CHANNEL_TYPE("error.access-denied.diagram-channel-type"),
ERROR_ACCESS_DENIED_DIAGRAM_RESOURCE_ID("error.access-denied.diagram-resource-id"),
ERROR_ACCESS_DENIED_AI_EXECUTION("error.access-denied.ai-execution"),
...
ERROR_BUSINESS_AI_OUTPUT_VALIDATION_FAILED("error.business.ai-output-validation-failed"),
ERROR_BUSINESS_AI_SELECTED_RESOURCE_UNSUPPORTED("error.business.ai-selected-resource-unsupported"),
ERROR_BUSINESS_WORK_COMMENT_CONTENT_REQUIRED("error.business.work-comment-content-required"),
...
ERROR_NOT_FOUND_AI_EXECUTION("error.not-found.ai-execution"),
ERROR_VALIDATION_FAILED("error.validation.failed"),
ERROR_UNEXPECTED("error.unexpected");
```

**Global localized exception handling** from `GlobalExceptionHandler.java` (lines 45-52, 118-126):
```java
@ExceptionHandler(LocalizedException.class)
public ResponseEntity<Map<String, String>> handleLocalizedException(LocalizedException ex, Locale locale) {
    final var message = messageSource.getMessage(
        Objects.requireNonNull(ex.getMessageCode()),
        ex.getMessageArgs(),
        locale
    );
    return ResponseEntity.status(Objects.requireNonNull(resolveStatus(ex))).body(Map.of("error", message));
}
```

```java
@ExceptionHandler(Exception.class)
public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex, Locale locale) {
    log.error("Unexpected error", ex);
    final var message = messageSource.getMessage(
        Objects.requireNonNull(MessageCode.ERROR_UNEXPECTED.code()),
        null,
        locale
    );
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", message));
}
```

**Message bundle placement** from `messages.properties` (lines 18-25, 143-164):
```properties
# === Access Denied ===
error.access-denied.not-member=User is not a member of this team
error.access-denied.not-admin=Only ADMIN can perform this action
error.access-denied.project-todo-owner-only=Only the TODO owner can view or change this personal TODO
error.access-denied.viewer-readonly=Viewers cannot modify resources
error.access-denied.diagram-channel-type=Incompatible channel type for diagram access policy: {0}
error.access-denied.diagram-resource-id=Diagram channel resourceId must be a valid Long: {0}
error.access-denied.ai-execution=You do not have access to this AI execution.

# === Validation ===
validation.not-blank.login-id=Login ID is required
validation.not-blank.password=Password is required
validation.not-blank.name=Name is required
validation.not-blank.team-name=Team name is required
validation.not-blank.project-name=Project name is required
validation.not-blank.diagram-name=Diagram name is required
validation.not-blank.plugin-id=Plugin ID is required
validation.not-blank.export-format=Export format is required
validation.not-blank.dictionary-set-name=Dictionary set name is required
validation.pattern.plugin-id=Plugin ID must be one of: erd, markdown, screen-spec, screendesign
validation.pattern.export-format=Export format must be md
validation.pattern.markdown-template-key=Template key must be one of: technical-spec, meeting-notes, release-note
validation.not-null.content=Content must not be null
validation.not-null.role=Role must not be null
validation.not-null.dictionary-set-id=Dictionary set ID is required
validation.not-blank.issue-title=Issue title is required
validation.not-null.issue-priority=Issue priority is required
validation.not-null.issue-status=Issue status is required
validation.not-blank.todo-title=TODO title is required
validation.not-null.todo-priority=TODO priority is required
validation.not-null.todo-status=TODO status is required
```

**Planner notes:**
- Add chat-specific message codes for unsupported scope, ambiguous scope if returned as an error, and validation keys such as `validation.not-blank.ai-message`.
- Add both English and Korean backend messages.
- Frontend visible text must go in `client/src/i18n/locales/{ko,en}/translation.json`.

---

### Frontend API, Types, and Query Hooks

**Applies to:** `client/src/api/aiChatApi.ts`, `client/src/types/ai-chat.ts`, `client/src/hooks/useAiChatExecution.ts`, `query-keys.ts`

**Analogs:** `aiProviderApi.ts`, `ai-provider.ts`, `useAiProviderStatus.ts`, `query-keys.ts`

**Typed API module pattern** from `aiProviderApi.ts` (lines 1-25):
```typescript
import axiosInstance from './axiosInstance';
import type {
  AiExecutionStatusResponse,
  AiProviderExecuteRequest,
  AiProviderExecuteResponse,
  AiProviderStatusResponse,
} from '@/types/ai-provider';

const AI_PROVIDER_BASE_PATH = '/ai/provider';

export async function fetchAiProviderStatus(): Promise<AiProviderStatusResponse> {
  const res = await axiosInstance.get<AiProviderStatusResponse>(
    `${AI_PROVIDER_BASE_PATH}/status`,
  );
  return res.data;
}

export async function executeAiProvider(
  request: AiProviderExecuteRequest,
): Promise<AiProviderExecuteResponse> {
  const res = await axiosInstance.post<AiProviderExecuteResponse>(
    `${AI_PROVIDER_BASE_PATH}/execute`,
    request,
  );
  return res.data;
}
```

**Frontend response type and guards pattern** from `ai-provider.ts` (lines 36-54, 73-87, 88-138):
```typescript
export interface AiProviderStatusResponse {
  provider: string;
  availability: AiProviderAvailability;
  message: string | null;
  checkedAt: string;
}

export interface AiProviderExecuteRequest {
  teamId: number;
  projectId: number;
  userMessage: string;
  locale?: string | null;
  selectedResource?: AiSelectedResourceRequest | null;
}
```

```typescript
export interface AiExecutionStatusResponse {
  executionId: string;
  provider: string;
  status: AiExecutionStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  answer: string | null;
  actions: AiActionDraftResponse[];
  error: AiProviderErrorResponse | null;
}

export type AiProviderExecuteResponse = AiExecutionStatusResponse;
```

```typescript
const AI_PROVIDER_AVAILABILITIES = new Set<string>([
  'AVAILABLE',
  'NOT_CONFIGURED',
  'CODEX_NOT_FOUND',
  'CODEX_NOT_LOGGED_IN',
  'UNSUPPORTED_ENVIRONMENT',
]);

export function isAiProviderAvailability(value: unknown): value is AiProviderAvailability {
  return typeof value === 'string' && AI_PROVIDER_AVAILABILITIES.has(value);
}

export function getAiProviderAvailabilityPresentation(
  availability: AiProviderDisplayAvailability,
): AiProviderAvailabilityPresentation {
  return AI_PROVIDER_AVAILABILITY_PRESENTATION[availability];
}
```

**React Query hook pattern** from `useAiProviderStatus.ts` (lines 1-11):
```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchAiProviderStatus } from '@/api/aiProviderApi';
import { queryKeys } from '@/constants/query-keys';

export function useAiProviderStatus() {
  return useQuery({
    queryKey: queryKeys.aiProvider.status(),
    queryFn: fetchAiProviderStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
```

**Query key namespace pattern** from `query-keys.ts` (lines 78-84):
```typescript
/** AI provider gateway 관련 쿼리 키 */
aiProvider: {
  /** AI provider 상태 */
  status: () => ['ai-provider', 'status'] as const,
  /** AI 실행 상세 */
  execution: (executionId: string) => ['ai-provider', 'executions', executionId] as const,
},
```

**Planner notes:**
- Place the API module in `client/src/api/aiChatApi.ts` to match existing conventions, even if research suggested a feature folder.
- Components must not import `axiosInstance` directly.
- Add `queryKeys.aiChat` for execution, context lookup, or confirmation candidate queries. Keep keys serializable and isolated from `aiProvider`.

---

### Frontend Global Drawer State and Local Persistence

**Applies to:** `client/src/stores/useAiChatStore.ts`, `client/src/constants/storage.ts`

**Analogs:** `useThemeStore.ts`, `useAuthStore.ts`, `useRecentProjectContext.ts`, `storage.ts`

**Zustand store with localStorage pattern** from `useThemeStore.ts` (lines 9-46):
```typescript
import { create } from 'zustand';
import { STORAGE_KEYS } from '@/constants/storage';
import { type ThemeName, resolveStoredTheme, isDarkTheme, applyThemeClass } from '@/lib/theme';

interface ThemeState {
  theme: ThemeName;
  isDark: boolean;
  setTheme: (nextTheme: ThemeName) => void;
}

const useThemeStore = create<ThemeState>((set) => {
  const initial = resolveStoredTheme(localStorage.getItem(STORAGE_KEYS.THEME));

  return {
    theme: initial,
    isDark: isDarkTheme(initial),

    setTheme: (nextTheme: ThemeName) => {
      localStorage.setItem(STORAGE_KEYS.THEME, nextTheme);
      applyThemeClass(document.documentElement, nextTheme);
      set({ theme: nextTheme, isDark: isDarkTheme(nextTheme) });
    },
  };
});
```

**Auth store localStorage boundary** from `useAuthStore.ts` (lines 38-58):
```typescript
const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
  refreshToken: localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
  loginId: localStorage.getItem(STORAGE_KEYS.LOGIN_ID),
  name: localStorage.getItem(STORAGE_KEYS.NAME),

  login: (accessToken, refreshToken, loginId, name) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(STORAGE_KEYS.LOGIN_ID, loginId);
    localStorage.setItem(STORAGE_KEYS.NAME, name);
    set({ accessToken, refreshToken, loginId, name });
  },

  logout: () => {
    const rt = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (rt) {
      axios.post(`${getApiBaseUrl()}/auth/logout`, { refreshToken: rt }).catch(() => {});
    }
    clearAuthState();
  },
}));
```

**Robust storage parsing pattern** from `useRecentProjectContext.ts` (lines 41-63, 75-92):
```typescript
function parseRecentProjectContext(raw: string | null): RecentProjectContext | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RecentProjectContext>;
    if (
      typeof parsed.teamId !== 'string' ||
      typeof parsed.projectId !== 'string' ||
      typeof parsed.recordedAt !== 'string'
    ) {
      return null;
    }
    return {
      teamId: parsed.teamId,
      projectId: parsed.projectId,
      recordedAt: parsed.recordedAt,
    };
  } catch {
    return null;
  }
}
```

```typescript
export function saveRecentProjectContext(teamId: string, projectId: string): RecentProjectContext {
  const next: RecentProjectContext = {
    teamId,
    projectId,
    recordedAt: new Date().toISOString(),
  };
  const key = buildRecentProjectContextStorageKey(teamId);
  const storage = getSessionStorage();
  if (!key || !storage) {
    return next;
  }
  try {
    storage.setItem(key, JSON.stringify(next));
  } catch (error) {
    logStorageWarning('set', error);
  }
  return next;
}
```

**Storage key convention** from `storage.ts` (lines 1-31):
```typescript
/** localStorage에 저장하는 키 상수. 인증 정보를 영속화하는 데 사용한다. */
export const STORAGE_KEYS = {
  /** JWT Access Token */
  ACCESS_TOKEN: 'accessToken',
  /** UUID Refresh Token */
  REFRESH_TOKEN: 'refreshToken',
  /** 사용자 로그인 ID */
  LOGIN_ID: 'loginId',
  /** 사용자 표시 이름 */
  NAME: 'name',
  /** i18next 언어 설정 */
  LANGUAGE: 'i18nextLng',
  ...
  /** 테마 설정 (paper | graphite | midnight) */
  THEME: 'smart-erd-theme',
  /** Electron 전용 서버 URL */
  SERVER_URL: 'smart-erd-server-url',
} as const;
```

**Planner notes:**
- No exact local Zustand `persist` middleware analog exists. Use the existing storage-key and parse/serialize discipline; if using Zustand `persist`, keep `partialize` to drawer open state, selected display context, rendered messages, timestamps, and source-chip display data only.
- Do not persist raw read context, prompt payloads, provider requests, access tokens, refresh tokens, cookies, or environment-derived values in the AI chat store.
- Add `STORAGE_KEYS.AI_CHAT_STATE = 'smart-erd-ai-chat-state'` or equivalent with JSDoc.

---

### Frontend Drawer, Context Chooser, and Response Cards

**Applies to:** `AiChatDrawer.tsx`, `AiChatTrigger.tsx`, `AiContextBar.tsx`, `AiResponseCards.tsx`, `Header.tsx`, `App.tsx`

**Analogs:** `dialog.tsx`, `command.tsx`, `AiProviderStatusBadge.tsx`, `Header.tsx`, `App.tsx`

**Radix Dialog primitive pattern** from `dialog.tsx` (lines 1-10, 32-59):
```typescript
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
```

```typescript
function DialogContent({
  className,
  children,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  ref?: React.Ref<HTMLDivElement>;
}) {
  const { t } = useTranslation();

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border border-border/85 bg-card p-6 shadow-editorial duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full border border-border/80 bg-card p-1.5 opacity-80 ring-offset-background transition-[opacity,background-color] hover:bg-secondary hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:text-muted-foreground">
```

**Command chooser pattern** from `command.tsx` (lines 22-39, 94-108):
```typescript
function CommandInput({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        ref={ref}
        className={cn(
          'flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
}
```

```typescript
function CommandItem({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
}
```

**AI trigger/status visual pattern** from `AiProviderStatusBadge.tsx` (lines 1-11, 36-59):
```typescript
import { Bot, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { useAiProviderStatus } from '@/hooks/useAiProviderStatus';
import { cn } from '@/lib/utils';
```

```typescript
export default function AiProviderStatusBadge() {
  const { t } = useTranslation();
  const { data, isError, isLoading } = useAiProviderStatus();
  const availability = resolveDisplayAvailability(data?.availability, isLoading, isError);
  const presentation = getAiProviderAvailabilityPresentation(availability);
  const label = t(presentation.labelKey);

  return (
    <Badge
      variant="outline"
      className={cn(
        'h-10 gap-2 rounded-md px-3 text-sm font-medium',
        TONE_CLASS[presentation.tone],
      )}
      aria-label={t('aiProvider.aria.status', { status: label })}
      aria-live="polite"
    >
      {availability === 'CHECKING' ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <Bot className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="whitespace-nowrap">{t('aiProvider.statusLabel', { status: label })}</span>
    </Badge>
  );
}
```

**Header utility slot pattern** from `Header.tsx` (lines 14-22, 50-83):
```typescript
interface HeaderProps {
  /** 현재 workspace 컨텍스트 */
  workspaceContext?: WorkspaceContext;
  /** 중앙 제목. 없으면 workspace 문서명을 사용한다. */
  title?: string;
  /** 우측 슬롯. 도메인 전용 액세서리는 page/erd 계층에서 조립해서 전달한다. */
  rightSlot?: React.ReactNode;
}
```

```typescript
rightSlot={
  <div className="header-utility-rail">
    {rightSlot}
    <div className="header-utility-group">
      <ThemeSwitcher />
      <LanguageSwitcher />
      {isElectron() && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(ROUTES.SETTINGS)}
          className="header-icon-button h-8 w-8"
          aria-label={t('settings.aria.settings')}
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}
    </div>
    {isAuthenticated && (
      <div className="header-utility-group">
        <span className="hidden text-sm font-medium text-header-foreground/90 xl:inline">
          {name}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="header-text-button h-8 px-3"
        >
```

**App protected route mounting pattern** from `App.tsx` (lines 39-73, 115-121):
```typescript
return (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Router>
      <Suspense
        fallback={
          <div className="h-screen flex items-center justify-center">
            <Spinner />
          </div>
        }
      >
        {needsServerSetup ? (
          <Routes>
            <Route path={ROUTES.GUIDE} element={<GuidePage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
            <Route path="*" element={<Navigate to={ROUTES.SETTINGS} replace />} />
          </Routes>
        ) : (
          <Routes>
            ...
            <Route
              path={ROUTES.TEAMS}
              element={
                <ProtectedRoute>
                  <TeamsPage />
                </ProtectedRoute>
              }
            />
```

```typescript
            <Route path="/" element={<Navigate to={ROUTES.TEAMS} replace />} />
            <Route path="*" element={<Navigate to={ROUTES.TEAMS} replace />} />
          </Routes>
        )}
      </Suspense>
    </Router>
  </QueryClientProvider>
);
```

**Planner notes:**
- Use existing Radix Dialog primitives to build a right-side drawer/sheet; do not add a new drawer dependency.
- Mount the drawer high enough in the authenticated app shell to survive route changes. If `ProtectedRoute` wraps each route independently, consider an authenticated shell wrapper or a global component inside `Router` that reads auth state.
- The trigger can live in `Header` utility rail and/or a global authenticated utility component, but the drawer state should be route-independent.
- Use i18n keys for all visible labels, placeholders, section headers, and ARIA labels.

---

### Frontend Route Context Resolver

**Applies to:** `client/src/hooks/useAiRouteContext.ts`, `AiContextBar.tsx`

**Analogs:** `ProjectWbsPage.tsx`, `DictionaryPage.tsx`, `useRecentProjectContext.ts`

**Strong route context pattern** from `ProjectWbsPage.tsx` (lines 22-39, 43-49):
```typescript
export default function ProjectWbsPage() {
  const { teamId, projectId } = useParams<{ teamId: string; projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { canEdit } = useTeamRole(teamId);
  const workspaceRef = useRef<WbsWorkspaceContentHandle | null>(null);

  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(teamId!),
    queryFn: () => fetchTeam(teamId!),
    enabled: Boolean(teamId),
  });

  const { data: project } = useQuery({
    queryKey: queryKeys.projects.detail(teamId!, projectId!),
    queryFn: () => fetchProject(teamId!, projectId!),
    enabled: Boolean(teamId) && Boolean(projectId),
  });
```

```typescript
<Header
  workspaceContext={{
    team: team ? { id: teamId!, name: team.name } : undefined,
    project: project ? { id: projectId!, name: project.name } : undefined,
    section: 'projects',
  }}
/>
```

**Weak/team-only context pattern** from `DictionaryPage.tsx` (lines 23-42, 65-70):
```typescript
export default function DictionaryPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { canEdit } = useTeamRole(teamId);
  const { recentProjectContext, clearRecentProjectContext } = useRecentProjectContext(teamId);
  const dictionaryRouteState = location.state as DictionaryWorkspaceRouteState | undefined;

  const { data: team } = useQuery({
    queryKey: queryKeys.teams.detail(teamId!),
    queryFn: () => fetchTeam(teamId!),
    enabled: !!teamId,
  });

  const { data: projects = [], isSuccess: isProjectsLoaded } = useQuery({
    queryKey: queryKeys.projects.byTeam(teamId!),
    queryFn: () => fetchProjects(teamId!),
    enabled: !!teamId,
  });
```

```typescript
<Header
  workspaceContext={{
    team: team ? { id: teamId!, name: team.name } : undefined,
    section: 'dictionary',
  }}
/>
```

**Recent context storage helper** from `useRecentProjectContext.ts` (lines 28-34, 109-140):
```typescript
export function buildRecentProjectContextStorageKey(teamId?: string): string | null {
  if (!teamId) {
    return null;
  }
  return `${STORAGE_KEYS.RECENT_PROJECT_CONTEXT_PREFIX}:${teamId}`;
}
```

```typescript
export function useRecentProjectContext(teamId?: string) {
  const [recentProjectContext, setRecentProjectContext] = useState<RecentProjectContext | null>(
    () => loadRecentProjectContext(teamId),
  );

  useEffect(() => {
    setRecentProjectContext(loadRecentProjectContext(teamId));
  }, [teamId]);

  const recordRecentProjectContext = useCallback(
    (projectId: string) => {
      if (!teamId) {
        return null;
      }
      const next = saveRecentProjectContext(teamId, projectId);
      setRecentProjectContext(next);
      return next;
    },
    [teamId],
  );

  return {
    recentProjectContext,
    recordRecentProjectContext,
    clearRecentProjectContext: clearStoredRecentProjectContext,
  };
}
```

**Planner notes:**
- `useAiRouteContext` should derive current `teamId`, `projectId`, labels, and context confidence from URL params and loaded query data.
- Team list, dictionary, and settings are weak project context screens. The hook can expose `scopeRequired: true` for project-data questions.
- The server remains authoritative; client context is only a default request hint.

---

### Tests

**Applies to:** backend MVC/service tests, frontend unit tests, Playwright smoke

**Analogs:** `AiProviderControllerMvcTest.java`, `AiExecutionGatewayTest.java`, `ai-provider-status.test.ts`, `diagram-loading.spec.ts`

**Backend MVC test setup** from `AiProviderControllerMvcTest.java` (lines 48-57):
```java
@BeforeEach
void setUp() {
    final var messageSource = new StaticMessageSource();
    messageSource.setUseCodeAsDefaultMessage(true);
    messageSource.addMessage(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code(), Locale.ENGLISH, "forbidden");
    this.mockMvc = MockMvcBuilders.standaloneSetup(new AiProviderController(aiExecutionGateway))
        .setControllerAdvice(new GlobalExceptionHandler(messageSource))
        .setCustomArgumentResolvers(new TestJwtArgumentResolver())
        .build();
    this.objectMapper = new ObjectMapper();
}
```

**Backend MVC execute assertion** from `AiProviderControllerMvcTest.java` (lines 96-109):
```java
mockMvc
    .perform(
        post("/api/ai/provider/execute")
            .with((request) -> {
                request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                return request;
            })
            .contentType(APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("teamId", 1, "projectId", 10, "userMessage", "status?")))
    )
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.executionId").value("exec-1"))
    .andExpect(jsonPath("$.status").value("FAILED"))
    .andExpect(jsonPath("$.error.type").value("NOT_CONFIGURED"));
```

**Backend service auth-preflight tests** from `AiExecutionGatewayTest.java` (lines 67-100):
```java
@Test
void executeRunsProviderOnlyAfterAuthorizationPreflight() {
    final var owner = User.builder().loginId("owner").password("encoded").name("Owner").build();
    final var team = Team.builder().name("team").owner(owner).build();
    final var project = Project.builder().team(team).name("project").build();
    when(projectContextLoader.load("tester", 1L, 10L, false))
        .thenReturn(new ProjectContextLoader.ProjectContext(team, project));
    when(aiProvider.status()).thenReturn(new AiProviderStatus("noop", AiProviderAvailability.NOT_CONFIGURED, null, Instant.EPOCH));
    when(aiProvider.execute(org.mockito.ArgumentMatchers.any()))
        .thenReturn(AiProviderResult.failed(new AiProviderError("NOT_CONFIGURED", "Not configured", "No provider", false)));

    final var result = gateway.execute(
        "tester",
        new AiExecutionGateway.ExecuteCommand(1L, 10L, "What can you do?", "ko", null)
    );

    assertThat(result.executionId()).isNotBlank();
    assertThat(result.state()).isEqualTo(AiExecutionState.FAILED);
    verify(projectContextLoader).load("tester", 1L, 10L, false);
    verify(aiProvider).execute(org.mockito.ArgumentMatchers.any());
    verify(auditService).record(org.mockito.ArgumentMatchers.any());
}
```

```java
@Test
void executeDoesNotInvokeProviderWhenAuthorizationFails() {
    when(projectContextLoader.load("tester", 1L, 10L, false))
        .thenThrow(new com.smarterd.domain.common.exception.DomainAccessDeniedException("error.access-denied.not-member"));

    org.assertj.core.api.Assertions.assertThatThrownBy(() ->
        gateway.execute("tester", new AiExecutionGateway.ExecuteCommand(1L, 10L, "hello", "ko", null))
    ).isInstanceOf(com.smarterd.domain.common.exception.DomainAccessDeniedException.class);

    verify(aiProvider, never()).execute(org.mockito.ArgumentMatchers.any());
    verify(auditService, never()).record(org.mockito.ArgumentMatchers.any());
}
```

**Frontend unit test pattern** from `ai-provider-status.test.ts` (lines 1-7, 23-34):
```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { queryKeys } from '../../src/constants/query-keys.js';
import {
  getAiProviderAvailabilityPresentation,
  isAiProviderAvailability,
} from '../../src/types/ai-provider.js';
```

```typescript
test('isAiProviderAvailability accepts only backend availability states', () => {
  assert.equal(isAiProviderAvailability('CODEX_NOT_LOGGED_IN'), true);
  assert.equal(isAiProviderAvailability('UNKNOWN'), false);
});

test('ai provider query keys are stable and isolated from project resources', () => {
  assert.deepEqual(queryKeys.aiProvider.status(), ['ai-provider', 'status']);
  assert.deepEqual(queryKeys.aiProvider.execution('exec-1'), [
    'ai-provider',
    'executions',
    'exec-1',
  ]);
});
```

**Playwright smoke pattern** from `diagram-loading.spec.ts` (lines 1-18):
```typescript
import { expect, test } from '@playwright/test';
import {
  captureDiagramReady,
  diagramUrl,
  expectDiagramHeaderVisible,
  getE2EConfig,
  loginViaUi,
  resolveTargetDiagram,
} from '../shared/diagram-e2e';

test('diagram first entry renders for a real project @smoke', async ({ page }) => {
  const config = getE2EConfig();
  const token = await loginViaUi(page, config);
  const target = await resolveTargetDiagram(token, config);

  const result = await captureDiagramReady(page, diagramUrl(config, target));
  await expectDiagramHeaderVisible(page, target);
  await expect(result.node).toBeVisible();
```

**Planner notes:**
- Backend tests must verify ambiguous/weak context returns confirmation without invoking provider.
- `AiReadContextServiceTest` must verify each read path loads authorized project context before data collection and defaults TODO to current user.
- Frontend store tests must assert explicit new conversation reset and that persisted state excludes secret/raw-context-shaped fields.
- E2E smoke should log in, open the global drawer from an authenticated screen, verify route changes do not close/reset it, submit a stubbed/Noop-backed message if feasible, and assert answer cards/source chips render.

## Shared Patterns

### API Modules Only

**Source:** `client/src/api/aiProviderApi.ts`
**Apply to:** all frontend chat HTTP calls

```typescript
const AI_PROVIDER_BASE_PATH = '/ai/provider';

export async function fetchAiProviderStatus(): Promise<AiProviderStatusResponse> {
  const res = await axiosInstance.get<AiProviderStatusResponse>(
    `${AI_PROVIDER_BASE_PATH}/status`,
  );
  return res.data;
}
```

### Server-Side Authorization Before AI Context

**Source:** `src/main/java/com/smarterd/application/ai/AiExecutionGateway.java`
**Apply to:** all chat execution/read-tool paths

```java
final var context = projectContextLoader.load(loginId, command.teamId(), command.projectId(), false);
selectedResourceValidator.validate(loginId, context.project(), command.selectedResource());
```

### Summary-First Reads

**Source:** `src/main/java/com/smarterd/api/project/dto/issue/ProjectIssueSummaryResponse.java`
**Apply to:** read tool outputs and source-chip counts

```java
final var registeredCount = items.stream().filter(item -> item.status() == ProjectIssueStatus.REGISTERED).count();
final var inProgressCount = items.stream().filter(item -> item.status() == ProjectIssueStatus.IN_PROGRESS).count();
final var doneCount = items.stream().filter(item -> item.status() == ProjectIssueStatus.DONE).count();
return new ProjectIssueSummaryResponse(items.size(), registeredCount, inProgressCount, doneCount);
```

### Localized Backend Errors

**Source:** `src/main/java/com/smarterd/api/common/GlobalExceptionHandler.java`
**Apply to:** chat validation, unsupported scope, denied reads

```java
final var message = messageSource.getMessage(
    Objects.requireNonNull(ex.getMessageCode()),
    ex.getMessageArgs(),
    locale
);
return ResponseEntity.status(Objects.requireNonNull(resolveStatus(ex))).body(Map.of("error", message));
```

### i18n Frontend Text

**Source:** `client/src/i18n/locales/ko/translation.json`
**Apply to:** drawer labels, cards, buttons, source chips, context bar, confirmation UI

```json
"aiProvider": {
  "statusLabel": "AI: {{status}}",
  "aria": {
    "status": "AI 런타임 상태: {{status}}"
  },
  "availability": {
    "available": "사용 가능",
    "notConfigured": "설정 필요",
    "codexNotFound": "Codex 없음",
    "codexNotLoggedIn": "로그인 필요",
    "unsupportedEnvironment": "지원 불가",
    "checking": "확인 중",
    "unknown": "확인 실패"
  }
}
```

## No Exact Analog Found

| File | Role | Data Flow | Reason | Use Instead |
|------|------|-----------|--------|-------------|
| `src/main/java/com/smarterd/application/ai/chat/AiChatContextResolver.java` | service | request-response | No existing service resolves ambiguous named projects or weak context for AI. | Combine `ProjectContextLoader`, `ProjectService.getProjects`, and localized `BusinessException` patterns. |
| `src/main/java/com/smarterd/application/ai/chat/AiSourceChipFactory.java` | service | transform | Source chips are new to Phase 10. | Copy summary DTO computation style from `ProjectIssueSummaryResponse`; construct chips from actual read results. |
| `client/src/stores/useAiChatStore.ts` | store | event-driven | No local Zustand `persist` middleware usage exists. | Use `STORAGE_KEYS` + defensive parse/serialize patterns; apply Zustand `persist` from research if planner chooses it. |
| `client/src/components/ai/AiChatDrawer.tsx` | component | event-driven | No existing right-side sheet component exists. | Build from Radix Dialog primitives in `components/ui/dialog.tsx` and style as a right-side drawer. |

## Metadata

**Project instructions checked:** `AGENTS.md` absent; `CLAUDE.md`, `README.md`, `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONVENTIONS.md` read.

**Project skills checked:** `.codex/skills/` and `.agents/skills/` absent in repository root.

**Analog search scope:** `src/main/java/com/smarterd/api/ai`, `src/main/java/com/smarterd/application/ai`, `src/main/java/com/smarterd/domain/pm`, `src/main/java/com/smarterd/domain/project`, `client/src/api`, `client/src/hooks`, `client/src/components`, `client/src/stores`, `client/src/constants`, backend and frontend tests.

**Key analogs read:** 31 files.

**Pattern extraction date:** 2026-06-02
