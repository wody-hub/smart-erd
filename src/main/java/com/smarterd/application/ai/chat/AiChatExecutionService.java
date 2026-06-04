package com.smarterd.application.ai.chat;

import com.smarterd.application.ai.AiExecutionGateway;
import com.smarterd.application.ai.AiProviderExecutionRunner;
import com.smarterd.application.ai.proposal.AiActionProposalService;
import com.smarterd.application.ai.proposal.AiActionProposalView;
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
    private final AiActionProposalService proposalService;

    /**
     * Resolves chat scope, runs the provider, and returns an answer with optional proposals.
     *
     * @param loginId requester login id
     * @param command chat command
     * @return chat view for the API layer
     */
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
        final var proposals = createProposals(loginId, execution, context);
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
            proposals,
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
        boolean multiProjectQuestion
    ) {
        /**
         * Creates a command from the legacy route-level chat fields.
         *
         * @param teamId team id
         * @param projectId project id
         * @param userMessage user prompt
         * @param locale requested locale
         * @param routeSource route source label
         * @return initialized chat command
         */
        public ChatCommand(Long teamId, Long projectId, String userMessage, String locale, String routeSource) {
            this(teamId, projectId, userMessage, locale, routeSource, null, null, false, false);
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

        /**
         * Detects when the question asks for member or team TODO aggregation.
         *
         * @return true when member TODO aggregation is requested
         */
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
        List<AiActionProposalView> proposals,
        String error,
        AiChatErrorView errorState
    ) {
        /**
         * Creates a backward-compatible view for older tests and callers.
         *
         * @param status chat status
         * @param conclusion leading conclusion text
         * @param interpretation provider answer text
         * @param confirmedFacts confirmed facts
         * @param needsConfirmation missing confirmation items
         * @param sourceChips source chips
         * @param confirmationCandidates project confirmation candidates
         * @param error safe error text
         * @return initialized chat view
         */
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
                List.of(),
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
            proposals = proposals == null ? List.of() : List.copyOf(proposals);
        }

        /**
         * Creates a scope-confirmation response without project candidates.
         *
         * @param needsConfirmation missing confirmation items
         * @param candidates project confirmation candidates
         * @return confirmation chat view
         */
        public static AiChatView needsConfirmation(
            List<String> needsConfirmation,
            List<AiChatContextResolver.ProjectCandidate> candidates
        ) {
            return needsConfirmation(needsConfirmation, candidates, null);
        }

        /**
         * Creates a scope-confirmation response with a stable reason code.
         *
         * @param needsConfirmation missing confirmation items
         * @param candidates project confirmation candidates
         * @param confirmationReason stable confirmation reason
         * @return confirmation chat view
         */
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
                List.of(),
                null,
                null
            );
        }

        /**
         * Creates a structured chat error response.
         *
         * @param code error code
         * @param message safe error message
         * @param retryable retry hint
         * @param needsConfirmation missing confirmation items
         * @return error chat view
         */
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

    /**
     * Converts a resolver confirmation reason to its wire value.
     *
     * @param context resolved chat context
     * @return confirmation reason name or null
     */
    private static String confirmationReason(AiChatContextResolver.ResolvedContext context) {
        return context.confirmationReason() == null ? null : context.confirmationReason().name();
    }

    /**
     * Picks the first resolved project id for provider execution metadata.
     *
     * @param context resolved chat context
     * @return representative project id or null
     */
    private static Long representativeProjectId(AiChatContextResolver.ResolvedContext context) {
        return context.projectIds().isEmpty() ? null : context.projectIds().getFirst();
    }

    /**
     * Builds the sanitized provider context from resolved scope and read data.
     *
     * @param command chat command
     * @param context resolved chat context
     * @param readContext sanitized read context
     * @return provider context map
     */
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

    /**
     * Builds the resolved scope section returned to the browser.
     *
     * @param context resolved chat context
     * @param readContext sanitized read context
     * @return chat context view
     */
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

    /**
     * Chooses the leading answer conclusion from confirmed read facts.
     *
     * @param readContext sanitized read context
     * @return conclusion text
     */
    private static String conclusion(AiReadContextService.ReadContext readContext) {
        if (!readContext.confirmedFacts().isEmpty()) {
            return readContext.confirmedFacts().getFirst();
        }
        return "확인된 프로젝트 요약을 기준으로 답변했습니다.";
    }

    /**
     * Maps provider failure into the safe chat error response.
     *
     * @param execution provider execution view
     * @param readContext sanitized read context
     * @param context resolved chat context
     * @return error chat view
     */
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
            List.of(),
            error.detail(),
            errorView(error)
        );
    }

    /**
     * Persists provider action drafts as sanitized approval proposals.
     *
     * @param loginId requester login id
     * @param execution provider execution view
     * @param context resolved chat context
     * @return sanitized proposal views
     */
    private List<AiActionProposalView> createProposals(
        String loginId,
        AiExecutionGateway.AiExecutionView execution,
        AiChatContextResolver.ResolvedContext context
    ) {
        if (execution.actions().isEmpty()) {
            return List.of();
        }
        return proposalService.createProposals(
            new AiActionProposalService.CreateCommand(
                execution.executionId(),
                execution.provider(),
                execution.promptVersion(),
                context.teamId(),
                representativeProjectId(context),
                loginId,
                execution.actions()
            )
        );
    }

    /**
     * Maps provider error metadata into the chat error card.
     *
     * @param error provider error metadata
     * @return chat error view
     */
    private static AiChatErrorView errorView(AiProviderError error) {
        return new AiChatErrorView(error.type(), error.detail(), error.retryable());
    }
}
