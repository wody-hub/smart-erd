package com.smarterd.api.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.smarterd.collaboration.CollaborationProtocolPolicy;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Objects;
import org.springframework.lang.Nullable;

/**
 * 공통 에러 응답 DTO.
 *
 * @param error 클라이언트에 표시할 다국어 에러 메시지
 * @param code 기계 판독용 오류 코드 (프로토콜 거부 시에만 포함)
 * @param minEditProtocolVersion 거부 시점의 최소 편집 버전 (프로토콜 거부 시에만 포함)
 */
@Schema(description = "공통 에러 응답")
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
    @Schema(description = "클라이언트에 표시할 다국어 에러 메시지", example = "User not found: testuser") String error,
    @Schema(description = "기계 판독용 오류 코드", example = "protocol-too-old") @Nullable String code,
    @Schema(description = "최소 편집 프로토콜 버전", example = "3") @Nullable Integer minEditProtocolVersion
) {
    /**
     * 에러 메시지로 공통 에러 응답을 생성한다.
     *
     * @param error 클라이언트에 표시할 다국어 에러 메시지
     * @return 공통 에러 응답
     */
    public static ErrorResponse of(String error) {
        return new ErrorResponse(Objects.requireNonNull(error), null, null);
    }

    /**
     * 편집 프로토콜 거부 응답을 생성한다.
     * @param error 다국어 안내 메시지
     * @param minEditProtocolVersion 거부 시점의 최소 편집 버전
     * @return 고정 오류 코드와 최소 버전을 포함한 공통 응답
     */
    public static ErrorResponse protocolTooOld(String error, int minEditProtocolVersion) {
        return new ErrorResponse(
            Objects.requireNonNull(error),
            CollaborationProtocolPolicy.PROTOCOL_TOO_OLD,
            minEditProtocolVersion
        );
    }
}
