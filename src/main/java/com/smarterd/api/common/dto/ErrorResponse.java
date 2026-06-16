package com.smarterd.api.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Objects;

/**
 * 공통 에러 응답 DTO.
 *
 * @param error 클라이언트에 표시할 다국어 에러 메시지
 */
@Schema(description = "공통 에러 응답")
public record ErrorResponse(
    @Schema(description = "클라이언트에 표시할 다국어 에러 메시지", example = "User not found: testuser") String error
) {
    /**
     * 에러 메시지로 공통 에러 응답을 생성한다.
     *
     * @param error 클라이언트에 표시할 다국어 에러 메시지
     * @return 공통 에러 응답
     */
    public static ErrorResponse of(String error) {
        return new ErrorResponse(Objects.requireNonNull(error));
    }
}
