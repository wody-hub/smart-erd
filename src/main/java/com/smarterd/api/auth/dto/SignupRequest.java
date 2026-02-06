package com.smarterd.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 회원가입 요청 DTO.
 *
 * @param loginId  로그인 ID (필수, 2~50자)
 * @param password 비밀번호 (필수, 8~100자)
 * @param name     사용자 이름 (필수, 1~50자)
 */
public record SignupRequest(
        @NotBlank @Size(min = 2, max = 50) String loginId,
        @NotBlank @Size(min = 8, max = 100) String password,
        @NotBlank @Size(min = 1, max = 50) String name
) {
}
