package com.smarterd.api.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 인증 응답 DTO (로그인·회원가입 공통).
 *
 * @param token   발급된 JWT 토큰
 * @param loginId 사용자 로그인 ID
 * @param name    사용자 표시 이름
 */
@Schema(description = "인증 응답 (로그인·회원가입 공통)")
public record AuthResponse(
        @Schema(description = "JWT 토큰", example = "eyJhbGciOiJIUzI1NiJ9...")
        String token,

        @Schema(description = "로그인 ID", example = "hong")
        String loginId,

        @Schema(description = "사용자 이름", example = "홍길동")
        String name
) {
}
