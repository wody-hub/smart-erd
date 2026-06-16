package com.smarterd.api.ai;

import static com.smarterd.api.ai.AiAuthenticationSupport.subject;

import com.smarterd.api.ai.dto.AiChatRequest;
import com.smarterd.api.ai.dto.AiChatResponse;
import com.smarterd.application.ai.chat.AiChatExecutionService;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only AI chat REST controller.
 */
@Tag(name = "AI Chat", description = "Read-only AI chat APIs")
@RestController
@RequestMapping("/api/ai/chat")
@RequiredArgsConstructor
public class AiChatController {

    private final AiChatExecutionService aiChatExecutionService;

    @Operation(summary = "Execute AI chat", description = "Runs a read-only AI chat request inside the AI harness.")
    @ApiResponse(
        responseCode = "200",
        description = "Chat response returned",
        content = @Content(schema = @Schema(implementation = AiChatResponse.class))
    )
    @ApiResponse(responseCode = "400", description = "Invalid chat request", content = @Content)
    @ApiResponse(responseCode = "403", description = "AI execution access denied", content = @Content)
    @PostMapping
    public ResponseEntity<AiChatResponse> chat(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody AiChatRequest request
    ) {
        return ResponseEntity.ok(
            AiChatResponse.from(aiChatExecutionService.execute(subject(jwt), request.toCommand()))
        );
    }
}
