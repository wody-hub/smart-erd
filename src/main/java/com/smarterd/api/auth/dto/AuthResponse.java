package com.smarterd.api.auth.dto;

/**
 * 인증 응답 DTO (로그인·회원가입 공통).
 *
 * @param token   발급된 JWT 토큰
 * @param loginId 사용자 로그인 ID
 * @param name    사용자 표시 이름
 */
public record AuthResponse(
        String token,
        String loginId,
        String name
) {
}
