package com.smarterd.application.ai.chat;

import com.smarterd.application.ai.AiSelectedResource;
import com.smarterd.application.ai.provider.AiProvider;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
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
    private final AiProvider aiProvider;
    private final ProviderOutputValidator outputValidator;

    public AiChatView execute(String loginId, ChatCommand command) {
        final var context = contextResolver.resolve(loginId, command.toResolveCommand());
        if (!context.isResolved()) {
            return AiChatView.needsConfirmation(context.needsConfirmation(), context.confirmationCandidates());
        }
        return AiChatView.needsConfirmation(List.of("AI chat execution is not implemented yet."), List.of());
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
            return new AiChatView(
                "NEEDS_CONFIRMATION",
                null,
                true,
                needsConfirmation == null || needsConfirmation.isEmpty() ? null : needsConfirmation.getFirst(),
                null,
                "질문 범위를 먼저 확인해야 합니다.",
                "",
                List.of(),
                needsConfirmation,
                List.of(),
                candidates.stream().map(AiChatConfirmationCandidateView::from).toList(),
                null,
                null
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
}
