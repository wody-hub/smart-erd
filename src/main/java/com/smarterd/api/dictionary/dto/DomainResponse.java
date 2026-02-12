package com.smarterd.api.dictionary.dto;

import com.smarterd.domain.dictionary.entity.Domain;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * 도메인 응답 DTO.
 *
 * @param id           도메인 ID
 * @param logicalName  논리명
 * @param physicalType 물리 데이터 타입
 * @param description  설명 (nullable)
 * @param teamId       소속 팀 ID
 * @param dictionarySetId 소속 사전 세트 ID
 * @param createdAt    생성 시각
 * @param updatedAt    수정 시각
 */
@Schema(description = "도메인 응답")
public record DomainResponse(
    @Schema(description = "도메인 ID", example = "1") Long id,

    @Schema(description = "논리명", example = "금액") String logicalName,

    @Schema(description = "물리 데이터 타입", example = "DECIMAL(15,2)") String physicalType,

    @Schema(description = "설명") String description,

    @Schema(description = "소속 팀 ID", example = "1") Long teamId,

    @Schema(description = "소속 사전 세트 ID", example = "1") Long dictionarySetId,

    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,

    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    /**
     * Domain 엔티티로부터 응답 DTO를 생성한다.
     *
     * @param domain Domain 엔티티
     * @return DomainResponse
     */
    public static DomainResponse from(Domain domain) {
        return new DomainResponse(
            domain.getId(),
            domain.getLogicalName(),
            domain.getPhysicalType(),
            domain.getDescription(),
            domain.getTeam().getId(),
            domain.getDictionarySet() != null ? domain.getDictionarySet().getId() : null,
            domain.getCreatedAt(),
            domain.getUpdatedAt()
        );
    }
}
