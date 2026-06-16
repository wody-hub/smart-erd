package com.smarterd.api.auth.dto;

import com.smarterd.domain.user.service.AuthResult;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 인증 응답 DTO (로그인·회원가입·토큰 갱신 공통).
 *
 * @param accessToken  JWT Access Token
 * @param refreshToken UUID Refresh Token
 * @param loginId      사용자 로그인 ID
 * @param name         사용자 표시 이름
 */
@Schema(description = "인증 응답 (로그인·회원가입·토큰 갱신 공통)")
public record AuthResponse(
    @Schema(description = "JWT Access Token", example = "eyJhbGciOiJIUzI1NiJ9...") String accessToken,

    @Schema(description = "UUID Refresh Token", example = "550e8400-e29b-41d4-a716-446655440000") String refreshToken,

    @Schema(description = "로그인 ID", example = "hong") String loginId,

    @Schema(description = "사용자 이름", example = "홍길동") String name
) {
    /**
     * Maps the domain authentication result into the REST response contract.
     *
     * @param result domain authentication result
     * @return REST authentication response
     */
    public static AuthResponse from(AuthResult result) {
        return new AuthResponse(result.accessToken(), result.refreshToken(), result.loginId(), result.name());
    }
}
