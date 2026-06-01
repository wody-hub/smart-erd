package com.smarterd.api.ai;

import com.smarterd.api.ai.dto.AiExecutionStatusResponse;
import com.smarterd.api.ai.dto.AiProviderExecuteRequest;
import com.smarterd.api.ai.dto.AiProviderExecuteResponse;
import com.smarterd.api.ai.dto.AiProviderStatusResponse;
import com.smarterd.application.ai.AiExecutionGateway;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI provider gateway REST controller.
 */
@RestController
@RequestMapping("/api/ai/provider")
@RequiredArgsConstructor
public class AiProviderController {

    private final AiExecutionGateway aiExecutionGateway;

    @GetMapping("/status")
    public ResponseEntity<AiProviderStatusResponse> getStatus(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AiProviderStatusResponse.from(aiExecutionGateway.status()));
    }

    @PostMapping("/execute")
    public ResponseEntity<AiProviderExecuteResponse> execute(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody AiProviderExecuteRequest request
    ) {
        return ResponseEntity.ok(AiProviderExecuteResponse.from(aiExecutionGateway.execute(jwt.getSubject(), request.toCommand())));
    }

    @GetMapping("/executions/{executionId}")
    public ResponseEntity<AiExecutionStatusResponse> getExecution(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable String executionId
    ) {
        return ResponseEntity.ok(AiExecutionStatusResponse.from(aiExecutionGateway.getExecution(jwt.getSubject(), executionId)));
    }

    @PostMapping("/executions/{executionId}/cancel")
    public ResponseEntity<AiExecutionStatusResponse> cancelExecution(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable String executionId
    ) {
        return ResponseEntity.ok(AiExecutionStatusResponse.from(aiExecutionGateway.cancelExecution(jwt.getSubject(), executionId)));
    }
}
