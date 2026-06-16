package com.smarterd.api.auth.dto;

import com.smarterd.domain.user.service.AuthRefreshTokenCommand;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 토큰 갱신 및 로그아웃 요청 DTO.
 *
 * @param refreshToken 클라이언트가 보유한 Refresh Token
 */
@Schema(description = "토큰 갱신 / 로그아웃 요청")
public record RefreshRequest(
    @Schema(description = "Refresh Token", example = "550e8400-e29b-41d4-a716-446655440000")
    @NotBlank(message = "{validation.not-blank.refresh-token}")
    String refreshToken
) {
    /**
     * Converts this REST request into the domain refresh-token command.
     *
     * @return domain refresh-token command
     */
    public AuthRefreshTokenCommand toCommand() {
        return new AuthRefreshTokenCommand(refreshToken);
    }
}
