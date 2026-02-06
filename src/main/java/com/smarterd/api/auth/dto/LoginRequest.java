package com.smarterd.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 로그인 요청 DTO.
 *
 * @param loginId  로그인 ID (필수, 최대 50자)
 * @param password 비밀번호 (필수, 최대 100자)
 */
public record LoginRequest(
        @NotBlank @Size(max = 50) String loginId,
        @NotBlank @Size(max = 100) String password
) {
}
