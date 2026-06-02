package com.smarterd.application.ai.chat;

import com.smarterd.application.ai.AiExecutionGateway;
import com.smarterd.application.ai.AiProviderExecutionRunner;
import com.smarterd.application.ai.AiSelectedResource;
import com.smarterd.application.ai.provider.AiProviderError;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Coordinates read-only AI chat execution.
 */
@Service
@RequiredArgsConstructor
public class AiChatExecutionService {

    private final AiChatContextResolver contextResolver;
    private final AiReadContextService readContextService;
    private final AiProviderExecutionRunner providerExecutionRunner;

    public AiChatView execute(String loginId, ChatCommand command) {
        final var context = contextResolver.resolve(loginId, command.toResolveCommand());
        if (context.status() == AiChatContextResolver.ScopeStatus.DENIED) {
            return AiChatView.error(
                "AI_CHAT_SCOPE_DENIED",
                "요청한 AI 채팅 범위에 접근할 수 없습니다.",
                false,
                context.needsConfirmation()
            );
        }
        if (!context.isResolved()) {
            return AiChatView.needsConfirmation(
                context.needsConfirmation(),
                context.confirmationCandidates(),
                confirmationReason(context)
            );
        }

        final var readContext = readContextService.read(loginId, command.toReadCommand(context));
        if (readContext.confirmedFacts().isEmpty()) {
            final var gaps = readContext.needsConfirmation().isEmpty()
                ? List.of("확인된 프로젝트 요약 정보가 없어 답변할 수 없습니다.")
                : readContext.needsConfirmation();
            return AiChatView.needsConfirmation(gaps, List.of(), "READ_CONTEXT_EMPTY");
        }

        final var execution = providerExecutionRunner.execute(
            loginId,
            new AiProviderExecutionRunner.RunCommand(
                context.teamId(),
                representativeProjectId(context),
                command.userMessage(),
                command.locale(),
                AiExecutionGateway.PROMPT_VERSION,
                providerContext(command, context, readContext)
            )
        );
        if (execution.error() != null) {
            return providerFailure(execution, readContext, context);
        }
        if (!execution.actions().isEmpty()) {
            return readOnlyActionRejected(execution, readContext, context);
        }
        return new AiChatView(
            "ANSWER",
            execution.executionId(),
            false,
            null,
            contextView(context, readContext),
            conclusion(readContext),
            execution.answer() == null ? "" : execution.answer(),
            readContext.confirmedFacts(),
            readContext.needsConfirmation(),
            readContext.sourceChips(),
            List.of(),
            null,
            null
        );
    }

    public record ChatCommand(
        Long teamId,
        Long projectId,
        String userMessage,
        String locale,
        String routeSource,
        String mentionedProjectName,
        String scopeMode,
        boolean currentTeamMode,
        boolean multiProjectQuestion,
        AiSelectedResource selectedResource
    ) {
        public ChatCommand(Long teamId, Long projectId, String userMessage, String locale, String routeSource) {
            this(teamId, projectId, userMessage, locale, routeSource, null, null, false, false, null);
        }

        AiChatContextResolver.ResolveCommand toResolveCommand() {
            return new AiChatContextResolver.ResolveCommand(
                teamId,
                projectId,
                routeSource,
                List.of(),
                mentionedProjectName,
                currentTeamMode,
                multiProjectQuestion
            );
        }

        AiReadContextService.ReadCommand toReadCommand(AiChatContextResolver.ResolvedContext context) {
            return new AiReadContextService.ReadCommand(
                context.teamId(),
                context.projectIds(),
                java.util.Set.of(),
                memberTodoSummaryRequested(),
                null,
                userMessage
            );
        }

        private boolean memberTodoSummaryRequested() {
            final var text = userMessage == null ? "" : userMessage.toLowerCase(java.util.Locale.ROOT);
            return text.contains("member todo") || text.contains("team todo") || text.contains("멤버") || text.contains("팀원");
        }
    }

    public record AiChatView(
        String status,
        String executionId,
        boolean requiresConfirmation,
        String confirmationReason,
        AiChatContextView context,
        String conclusion,
        String interpretation,
        List<String> confirmedFacts,
        List<String> needsConfirmation,
        List<AiReadContextService.SourceChip> sourceChips,
        List<AiChatConfirmationCandidateView> confirmationCandidates,
        String error,
        AiChatErrorView errorState
    ) {
        public AiChatView(
            String status,
            String conclusion,
            String interpretation,
            List<String> confirmedFacts,
            List<String> needsConfirmation,
            List<AiReadContextService.SourceChip> sourceChips,
            List<AiChatContextResolver.ProjectCandidate> confirmationCandidates,
            String error
        ) {
            this(
                status,
                null,
                "NEEDS_CONFIRMATION".equals(status),
                null,
                null,
                conclusion,
                interpretation,
                confirmedFacts,
                needsConfirmation,
                sourceChips,
                confirmationCandidates.stream().map(AiChatConfirmationCandidateView::from).toList(),
                error,
                error == null ? null : new AiChatErrorView("AI_CHAT_ERROR", error, false)
            );
        }

        public AiChatView {
            confirmedFacts = confirmedFacts == null ? List.of() : List.copyOf(confirmedFacts);
            needsConfirmation = needsConfirmation == null ? List.of() : List.copyOf(needsConfirmation);
            sourceChips = sourceChips == null ? List.of() : List.copyOf(sourceChips);
            confirmationCandidates =
                confirmationCandidates == null ? List.of() : List.copyOf(confirmationCandidates);
        }

        public static AiChatView needsConfirmation(
            List<String> needsConfirmation,
            List<AiChatContextResolver.ProjectCandidate> candidates
        ) {
            return needsConfirmation(needsConfirmation, candidates, null);
        }

        public static AiChatView needsConfirmation(
            List<String> needsConfirmation,
            List<AiChatContextResolver.ProjectCandidate> candidates,
            String confirmationReason
        ) {
            final var safeNeedsConfirmation = needsConfirmation == null ? List.<String>of() : List.copyOf(needsConfirmation);
            final var safeCandidates = candidates == null ? List.<AiChatContextResolver.ProjectCandidate>of() : candidates;
            return new AiChatView(
                "NEEDS_CONFIRMATION",
                null,
                true,
                confirmationReason == null && !safeNeedsConfirmation.isEmpty()
                    ? safeNeedsConfirmation.getFirst()
                    : confirmationReason,
                null,
                "질문 범위를 먼저 확인해야 합니다.",
                "",
                List.of(),
                safeNeedsConfirmation,
                List.of(),
                safeCandidates.stream().map(AiChatConfirmationCandidateView::from).toList(),
                null,
                null
            );
        }

        public static AiChatView error(String code, String message, boolean retryable, List<String> needsConfirmation) {
            return new AiChatView(
                "ERROR",
                null,
                false,
                null,
                null,
                "",
                "",
                List.of(),
                needsConfirmation,
                List.of(),
                List.of(),
                message,
                new AiChatErrorView(code, message, retryable)
            );
        }
    }

    public record AiChatContextView(
        String kind,
        Long teamId,
        List<Long> projectIds,
        String label,
        List<String> toolsUsed,
        Map<String, Object> caps
    ) {
        public AiChatContextView {
            projectIds = projectIds == null ? List.of() : List.copyOf(projectIds);
            toolsUsed = toolsUsed == null ? List.of() : List.copyOf(toolsUsed);
            caps = caps == null ? Map.of() : Map.copyOf(caps);
        }
    }

    public record AiChatConfirmationCandidateView(
        String id,
        String label,
        String kind,
        Long teamId,
        String teamName,
        Long projectId,
        String projectName,
        String reason
    ) {
        static AiChatConfirmationCandidateView from(AiChatContextResolver.ProjectCandidate candidate) {
            return new AiChatConfirmationCandidateView(
                "project:" + candidate.projectId(),
                candidate.projectName(),
                "project",
                candidate.teamId(),
                null,
                candidate.projectId(),
                candidate.projectName(),
                null
            );
        }
    }

    public record AiChatErrorView(String code, String message, boolean retryable) {}

    private static String confirmationReason(AiChatContextResolver.ResolvedContext context) {
        return context.confirmationReason() == null ? null : context.confirmationReason().name();
    }

    private static Long representativeProjectId(AiChatContextResolver.ResolvedContext context) {
        return context.projectIds().isEmpty() ? null : context.projectIds().getFirst();
    }

    private static Map<String, Object> providerContext(
        ChatCommand command,
        AiChatContextResolver.ResolvedContext context,
        AiReadContextService.ReadContext readContext
    ) {
        final var map = new LinkedHashMap<String, Object>();
        map.put("teamId", context.teamId());
        map.put("projectIds", context.projectIds());
        map.put("scopeLabel", context.label());
        map.put("locale", command.locale() == null ? "" : command.locale());
        map.put("toolsUsed", readContext.toolsUsed().stream().map(Enum::name).toList());
        map.put("readContext", readContext.sanitizedProviderContext().isBlank()
            ? readContext.sanitizedContext()
            : readContext.sanitizedProviderContext());
        map.put("sourceChips", readContext.sourceChips());
        map.put("caps", readContext.capMetadata());
        return Map.copyOf(map);
    }

    private static AiChatContextView contextView(
        AiChatContextResolver.ResolvedContext context,
        AiReadContextService.ReadContext readContext
    ) {
        return new AiChatContextView(
            context.projectIds().size() > 1 ? "multi-project" : "project",
            context.teamId(),
            context.projectIds(),
            context.label(),
            readContext.toolsUsed().stream().map(Enum::name).toList(),
            readContext.capMetadata()
        );
    }

    private static String conclusion(AiReadContextService.ReadContext readContext) {
        if (!readContext.confirmedFacts().isEmpty()) {
            return readContext.confirmedFacts().getFirst();
        }
        return "확인된 프로젝트 요약을 기준으로 답변했습니다.";
    }

    private static AiChatView providerFailure(
        AiExecutionGateway.AiExecutionView execution,
        AiReadContextService.ReadContext readContext,
        AiChatContextResolver.ResolvedContext context
    ) {
        final var error = execution.error();
        return new AiChatView(
            "ERROR",
            execution.executionId(),
            false,
            null,
            contextView(context, readContext),
            conclusion(readContext),
            "",
            readContext.confirmedFacts(),
            readContext.needsConfirmation(),
            readContext.sourceChips(),
            List.of(),
            error.detail(),
            errorView(error)
        );
    }

    private static AiChatView readOnlyActionRejected(
        AiExecutionGateway.AiExecutionView execution,
        AiReadContextService.ReadContext readContext,
        AiChatContextResolver.ResolvedContext context
    ) {
        final var message = "Provider returned action drafts, which are not allowed in read-only chat.";
        return new AiChatView(
            "ERROR",
            execution.executionId(),
            false,
            null,
            contextView(context, readContext),
            conclusion(readContext),
            "",
            readContext.confirmedFacts(),
            readContext.needsConfirmation(),
            readContext.sourceChips(),
            List.of(),
            message,
            new AiChatErrorView("READ_ONLY_PROVIDER_ACTION_REJECTED", message, false)
        );
    }

    private static AiChatErrorView errorView(AiProviderError error) {
        return new AiChatErrorView(error.type(), error.detail(), error.retryable());
    }
}
