package com.smarterd.api.ai;

import com.smarterd.api.ai.dto.AiChatRequest;
import com.smarterd.api.ai.dto.AiChatResponse;
import com.smarterd.application.ai.chat.AiChatExecutionService;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.message.MessageCode;
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
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiChatController {

    private final AiChatExecutionService aiChatExecutionService;

    @PostMapping("/chat")
    public ResponseEntity<AiChatResponse> chat(
        @AuthenticationPrincipal Jwt jwt,
        @Valid @RequestBody AiChatRequest request
    ) {
        if (jwt == null) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_AI_EXECUTION.code());
        }
        return ResponseEntity.ok(AiChatResponse.from(aiChatExecutionService.execute(jwt.getSubject(), request.toCommand())));
    }
}
