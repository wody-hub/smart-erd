package com.smarterd.api.auth.dto;

import com.smarterd.domain.user.service.AuthLoginCommand;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 로그인 요청 DTO.
 *
 * @param loginId  로그인 ID (필수, 최대 50자)
 * @param password 비밀번호 (필수, 최대 100자)
 */
@Schema(description = "로그인 요청")
public record LoginRequest(
    @Schema(description = "로그인 ID", example = "hong")
    @NotBlank(message = "{validation.not-blank.login-id}")
    @Size(max = 50, message = "{validation.size.login-id}")
    String loginId,

    @Schema(description = "비밀번호", example = "password123")
    @NotBlank(message = "{validation.not-blank.password}")
    @Size(max = 100, message = "{validation.size.password}")
    String password
) {
    /**
     * Converts this REST request into the domain login command.
     *
     * @param clientIp resolved client IP address
     * @return domain login command
     */
    public AuthLoginCommand toCommand(String clientIp) {
        return new AuthLoginCommand(loginId, password, clientIp);
    }
}
