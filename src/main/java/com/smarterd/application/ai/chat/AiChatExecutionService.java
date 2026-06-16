package com.smarterd.application.ai.chat;

import com.smarterd.application.ai.AiExecutionGateway;
import com.smarterd.application.ai.AiProviderExecutionRunner;
import com.smarterd.application.ai.proposal.AiActionProposalCreateCommand;
import com.smarterd.application.ai.proposal.AiActionProposalService;
import com.smarterd.application.ai.proposal.AiActionProposalView;
import com.smarterd.application.ai.provider.AiProviderError;
import com.smarterd.utils.AppStringUtils;
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
    public AiChatView execute(String loginId, AiChatCommand command) {
        final var context = contextResolver.resolve(loginId, command.toResolveCommand());
        if (context.status() == AiChatScopeStatus.DENIED) {
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

    /**
     * Converts a resolver confirmation reason to its wire value.
     *
     * @param context resolved chat context
     * @return confirmation reason name or null
     */
    private static String confirmationReason(AiChatResolvedContext context) {
        return context.confirmationReason() == null ? null : context.confirmationReason().name();
    }

    /**
     * Picks the first resolved project id for provider execution metadata.
     *
     * @param context resolved chat context
     * @return representative project id or null
     */
    private static Long representativeProjectId(AiChatResolvedContext context) {
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
        AiChatCommand command,
        AiChatResolvedContext context,
        AiReadContextService.ReadContext readContext
    ) {
        final var map = new LinkedHashMap<String, Object>();
        map.put("teamId", context.teamId());
        map.put("projectIds", context.projectIds());
        map.put("scopeLabel", context.label());
        map.put("locale", command.locale() == null ? "" : command.locale());
        map.put("toolsUsed", readContext.toolsUsed().stream().map(Enum::name).toList());
        map.put(
            "readContext",
            AppStringUtils.isBlank(readContext.sanitizedProviderContext())
                ? readContext.sanitizedContext()
                : readContext.sanitizedProviderContext()
        );
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
        AiChatResolvedContext context,
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
        AiChatResolvedContext context
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
        AiChatResolvedContext context
    ) {
        if (execution.actions().isEmpty()) {
            return List.of();
        }
        return proposalService.createProposals(
            new AiActionProposalCreateCommand(
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
