package com.smarterd.api.ai.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.ai.chat.AiChatExecutionService;
import jakarta.validation.Validation;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class AiChatDtoContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void requestAcceptsFrontendMessageContextContractWithoutSelectedResource() throws Exception {
        final var request = new AiChatRequest(
            "프로젝트 리스크를 요약해줘",
            null,
            null,
            "Alpha",
            "PROJECT",
            "ko",
            new AiChatContextRequest(
                "project",
                1L,
                "Platform Team",
                10L,
                "Route Project",
                "route",
                "2026-06-02T06:00:00Z",
                "strong",
                false
            ),
            null
        );

        final var command = request.toCommand();
        final var json = objectMapper.readTree(objectMapper.writeValueAsString(request));

        assertThat(command.userMessage()).isEqualTo("프로젝트 리스크를 요약해줘");
        assertThat(command.teamId()).isEqualTo(1L);
        assertThat(command.projectId()).isEqualTo(10L);
        assertThat(command.mentionedProjectName()).isEqualTo("Alpha");
        assertThat(command.scopeMode()).isEqualTo("PROJECT");
        assertThat(json.has("selectedResource")).isFalse();
    }

    @Test
    void teamContextMultiProjectRequestMapsToCurrentTeamFanoutCommand() {
        final var request = new AiChatRequest(
            "팀 전체 TODO 현황 알려줘",
            1L,
            null,
            null,
            "MULTI_PROJECT",
            "ko",
            new AiChatContextRequest(
                "team",
                1L,
                "Platform Team",
                null,
                null,
                "route",
                "2026-06-02T06:00:00Z",
                "team",
                true
            ),
            null
        );

        final var command = request.toCommand();

        assertThat(command.teamId()).isEqualTo(1L);
        assertThat(command.projectId()).isNull();
        assertThat(command.scopeMode()).isEqualTo("MULTI_PROJECT");
        assertThat(command.currentTeamMode()).isTrue();
        assertThat(command.multiProjectQuestion()).isTrue();
    }

    @Test
    void requestValidationUsesMessageKeysForBlankAndOversizedPrompt() {
        final var validator = Validation.buildDefaultValidatorFactory().getValidator();
        final var blankRequest = new AiChatRequest(" ", 1L, 10L, null, null, "ko", null, null);
        final var oversizedRequest = new AiChatRequest("x".repeat(4001), 1L, 10L, null, null, "ko", null, null);

        assertThat(validator.validate(blankRequest))
            .extracting((violation) -> violation.getConstraintDescriptor().getAttributes().get("message"))
            .contains("{validation.not-blank.ai-chat-message}");
        assertThat(validator.validate(oversizedRequest))
            .extracting((violation) -> violation.getConstraintDescriptor().getAttributes().get("message"))
            .contains("{validation.size.ai-chat-message}");
    }

    @Test
    void aiRequestValidationUsesLocalizedMessageKeys() {
        final var validator = Validation.buildDefaultValidatorFactory().getValidator();
        final var providerRequest = new AiProviderExecuteRequest(
            null,
            null,
            "",
            "x".repeat(21),
            new AiSelectedResourceRequest("", null)
        );
        final var chatRequest = new AiChatRequest(
            "status?",
            null,
            null,
            "x".repeat(121),
            "x".repeat(41),
            "x".repeat(21),
            null,
            null
        );
        final var contextRequest = new AiChatContextRequest(
            "x".repeat(41),
            null,
            "x".repeat(121),
            null,
            "x".repeat(121),
            "x".repeat(41),
            "x".repeat(41),
            "x".repeat(41),
            false
        );
        final var decisionRequest = new AiActionProposalDecisionRequest(null);

        final var messages = Stream.of(
            validator.validate(providerRequest),
            validator.validate(chatRequest),
            validator.validate(contextRequest),
            validator.validate(decisionRequest)
        )
            .flatMap((violations) -> violations.stream())
            .map((violation) -> String.valueOf(violation.getConstraintDescriptor().getAttributes().get("message")))
            .toList();

        assertThat(messages).isNotEmpty();
        assertThat(messages).allSatisfy((message) -> assertThat(message).startsWith("{validation."));
    }

    @Test
    void responseContractContainsReadOnlySectionsAndNoWriteControls() throws Exception {
        final var response = new AiChatResponse(
            "ANSWER",
            "exec-1",
            false,
            null,
            List.of(
                new AiConfirmationCandidateResponse(
                    "project:10",
                    "Alpha Project",
                    "project",
                    1L,
                    "Platform Team",
                    10L,
                    "Alpha Project",
                    "exact"
                )
            ),
            new AiChatContextResponse(
                "project",
                1L,
                List.of(10L),
                "Alpha Project",
                List.of("ISSUES"),
                Map.of("factReadCount", 2)
            ),
            List.of(new AiChatSourceChipResponse("Alpha Project", "issues", 12, null, 10L)),
            "Delayed issues: 2",
            List.of("Delayed issues: 2"),
            "Risk is concentrated in API work.",
            List.of(),
            List.of(),
            null,
            null
        );

        final var json = objectMapper.readTree(objectMapper.writeValueAsString(response));

        assertThat(json.get("executionId").asText()).isEqualTo("exec-1");
        assertThat(json.get("requiresConfirmation").asBoolean()).isFalse();
        assertThat(json.get("context").get("label").asText()).isEqualTo("Alpha Project");
        assertThat(json.get("sourceChips").get(0).get("tool").asText()).isEqualTo("issues");
        assertThat(json.get("proposals").isArray()).isTrue();
        assertThat(json.get("proposals")).isEmpty();
        assertThat(json.has("actions")).isFalse();
        assertThat(json.has("proposal")).isFalse();
        assertThat(json.has("approval")).isFalse();
        assertThat(json.has("diff")).isFalse();
    }

    @Test
    void aiApiDtoContractsAreTopLevelRecords() {
        final var dtoTypes = List.of(
            AiActionDraftResponse.class,
            AiActionProposalDecisionRequest.class,
            AiActionProposalDecisionResponse.class,
            AiActionProposalFieldChangeResponse.class,
            AiActionProposalResponse.class,
            AiActionProposalResultResponse.class,
            AiActionProposalTargetResponse.class,
            AiChatContextRequest.class,
            AiChatContextResponse.class,
            AiChatErrorResponse.class,
            AiChatRequest.class,
            AiChatResponse.class,
            AiChatSourceChipResponse.class,
            AiConfirmationCandidateResponse.class,
            AiExecutionStatusResponse.class,
            AiProjectHistoryItemResponse.class,
            AiProjectHistoryResponse.class,
            AiProviderErrorResponse.class,
            AiProviderExecuteRequest.class,
            AiProviderExecuteResponse.class,
            AiProviderStatusResponse.class,
            AiSelectedResourceRequest.class
        );

        assertThat(dtoTypes).allSatisfy((dtoType) ->
            assertThat(dtoType.getDeclaredClasses()).as(dtoType.getName()).isEmpty()
        );
    }
}
