package com.smarterd.api.ai;

import static com.smarterd.api.ai.AiAuthenticationSupport.subject;

import com.smarterd.api.ai.dto.AiExecutionStatusResponse;
import com.smarterd.api.ai.dto.AiProviderExecuteRequest;
import com.smarterd.api.ai.dto.AiProviderExecuteResponse;
import com.smarterd.api.ai.dto.AiProviderStatusResponse;
import com.smarterd.application.ai.AiExecutionGateway;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "AI Provider", description = "AI provider status and execution APIs")
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiProviderController {

    private final AiExecutionGateway aiExecutionGateway;

    @Operation(summary = "Get AI provider status", description = "Returns the current AI provider availability.")
    @ApiResponse(
        responseCode = "200",
        description = "Status returned",
        content = @Content(schema = @Schema(implementation = AiProviderStatusResponse.class))
    )
    @GetMapping("/providers/current/status")
    public ResponseEntity<AiProviderStatusResponse> getStatus(@AuthenticationPrincipal Jwt jwt) {
        subject(jwt);
        return ResponseEntity.ok(AiProviderStatusResponse.from(aiExecutionGateway.status()));
    }

    @Operation(
        summary = "Create AI execution",
        description = "Starts an AI execution for the selected project context."
    )
    @ApiResponse(
        responseCode = "200",
        description = "Execution completed or queued",
        content = @Content(schema = @Schema(implementation = AiProviderExecuteResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "Invalid execution request", content = @Content)
    @ApiResponse(responseCode = "403", description = "AI execution access denied", content = @Content)
    @PostMapping("/executions")
    public ResponseEntity<AiProviderExecuteResponse> execute(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody AiProviderExecuteRequest request
    ) {
        return ResponseEntity.ok(
            AiProviderExecuteResponse.from(aiExecutionGateway.execute(subject(jwt), request.toCommand()))
        );
    }

    @Operation(summary = "Get AI execution", description = "Returns one AI execution status owned by the current user.")
    @ApiResponse(
        responseCode = "200",
        description = "Execution status returned",
        content = @Content(schema = @Schema(implementation = AiExecutionStatusResponse.class))
    )
    @ApiResponse(responseCode = "403", description = "AI execution access denied", content = @Content)
    @GetMapping("/executions/{executionId}")
    public ResponseEntity<AiExecutionStatusResponse> getExecution(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable String executionId
    ) {
        return ResponseEntity.ok(
            AiExecutionStatusResponse.from(aiExecutionGateway.getExecution(subject(jwt), executionId))
        );
    }

    @Operation(
        summary = "Create AI execution cancellation",
        description = "Requests cancellation for one AI execution."
    )
    @ApiResponse(
        responseCode = "200",
        description = "Execution cancellation state returned",
        content = @Content(schema = @Schema(implementation = AiExecutionStatusResponse.class))
    )
    @ApiResponse(responseCode = "403", description = "AI execution access denied", content = @Content)
    @PostMapping("/executions/{executionId}/cancellation")
    public ResponseEntity<AiExecutionStatusResponse> cancelExecution(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable String executionId
    ) {
        return ResponseEntity.ok(
            AiExecutionStatusResponse.from(aiExecutionGateway.cancelExecution(subject(jwt), executionId))
        );
    }
}
