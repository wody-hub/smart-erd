package com.smarterd.api.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.smarterd.api.ai.dto.AiActionDraftResponse;
import com.smarterd.api.ai.dto.AiActionProposalDecisionRequest;
import com.smarterd.api.ai.dto.AiActionProposalDecisionResponse;
import com.smarterd.api.ai.dto.AiActionProposalFieldChangeResponse;
import com.smarterd.api.ai.dto.AiActionProposalResponse;
import com.smarterd.api.ai.dto.AiActionProposalResultResponse;
import com.smarterd.api.ai.dto.AiActionProposalTargetResponse;
import com.smarterd.api.ai.dto.AiChatContextRequest;
import com.smarterd.api.ai.dto.AiChatContextResponse;
import com.smarterd.api.ai.dto.AiChatErrorResponse;
import com.smarterd.api.ai.dto.AiChatRequest;
import com.smarterd.api.ai.dto.AiChatResponse;
import com.smarterd.api.ai.dto.AiChatSourceChipResponse;
import com.smarterd.api.ai.dto.AiConfirmationCandidateResponse;
import com.smarterd.api.ai.dto.AiExecutionStatusResponse;
import com.smarterd.api.ai.dto.AiProjectHistoryItemResponse;
import com.smarterd.api.ai.dto.AiProjectHistoryResponse;
import com.smarterd.api.ai.dto.AiProviderErrorResponse;
import com.smarterd.api.ai.dto.AiProviderExecuteRequest;
import com.smarterd.api.ai.dto.AiProviderExecuteResponse;
import com.smarterd.api.ai.dto.AiProviderStatusResponse;
import com.smarterd.api.ai.dto.AiSelectedResourceRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

class AiOpenApiContractTest {

    @Test
    void aiControllersDeclareOpenApiTagsAndOperations() {
        final var controllerTypes = List.of(
            AiActionProposalController.class,
            AiChatController.class,
            AiProviderController.class,
            AiProjectHistoryController.class
        );

        assertThat(controllerTypes).allSatisfy((controllerType) -> {
            assertThat(controllerType.isAnnotationPresent(Tag.class)).as(controllerType.getName()).isTrue();
            assertThat(
                List.of(controllerType.getDeclaredMethods()).stream().filter(this::isEndpointMethod).toList()
            ).allSatisfy((method) ->
                assertThat(method.isAnnotationPresent(Operation.class)).as(method.getName()).isTrue()
            );
        });
    }

    @Test
    void aiDtosDeclareOpenApiSchemas() {
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
            assertThat(dtoType.isAnnotationPresent(Schema.class)).as(dtoType.getName()).isTrue()
        );
    }

    private boolean isEndpointMethod(Method method) {
        return method.isAnnotationPresent(GetMapping.class) || method.isAnnotationPresent(PostMapping.class);
    }
}
