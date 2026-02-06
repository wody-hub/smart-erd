package com.smarterd.api.auth.dto;

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
    @Schema(description = "로그인 ID", example = "hong") @NotBlank @Size(max = 50) String loginId,

    @Schema(description = "비밀번호", example = "password123") @NotBlank @Size(max = 100) String password
) {}
