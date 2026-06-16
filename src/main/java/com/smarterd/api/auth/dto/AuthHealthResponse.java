package com.smarterd.api.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Authentication API health response.
 *
 * @param status server status
 */
@Schema(description = "인증 API 헬스 체크 응답")
public record AuthHealthResponse(@Schema(description = "서버 상태", example = "ok") String status) {
    /**
     * Builds the standard healthy response.
     *
     * @return healthy auth API response
     */
    public static AuthHealthResponse ok() {
        return new AuthHealthResponse("ok");
    }
}
