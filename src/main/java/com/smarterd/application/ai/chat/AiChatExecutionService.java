package com.smarterd.application.ai.chat;

import com.smarterd.application.ai.provider.AiProvider;
import com.smarterd.application.ai.validation.ProviderOutputValidator;
import java.util.List;
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

    public record ChatCommand(Long teamId, Long projectId, String userMessage, String locale, String routeSource) {
        AiChatContextResolver.ResolveCommand toResolveCommand() {
            return new AiChatContextResolver.ResolveCommand(teamId, projectId, routeSource, List.of(), null, false, false);
        }
    }

    public record AiChatView(
        String status,
        String conclusion,
        String interpretation,
        List<String> confirmedFacts,
        List<String> needsConfirmation,
        List<AiReadContextService.SourceChip> sourceChips,
        List<AiChatContextResolver.ProjectCandidate> confirmationCandidates,
        String error
    ) {
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
                "질문 범위를 먼저 확인해야 합니다.",
                "",
                List.of(),
                needsConfirmation,
                List.of(),
                candidates,
                null
            );
        }
    }
}
