package com.smarterd.api.dictionary.dto;

import com.smarterd.domain.dictionary.entity.Term;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * 용어 응답 DTO.
 *
 * @param id                용어 ID
 * @param logicalName       논리명
 * @param physicalName      물리명
 * @param description       설명 (nullable)
 * @param teamId            소속 팀 ID
 * @param dictionarySetId   소속 사전 세트 ID
 * @param domainId          연결 도메인 ID (nullable)
 * @param domainLogicalName 연결 도메인 논리명 (nullable)
 * @param createdAt         생성 시각
 * @param updatedAt         수정 시각
 */
@Schema(description = "용어 응답")
public record TermResponse(
    @Schema(description = "용어 ID", example = "1") Long id,

    @Schema(description = "논리명", example = "사용자명") String logicalName,

    @Schema(description = "물리명", example = "user_name") String physicalName,

    @Schema(description = "설명") String description,

    @Schema(description = "소속 팀 ID", example = "1") Long teamId,

    @Schema(description = "소속 사전 세트 ID", example = "1") Long dictionarySetId,

    @Schema(description = "연결 도메인 ID") Long domainId,

    @Schema(description = "연결 도메인 논리명") String domainLogicalName,

    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,

    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    /**
     * Term 엔티티로부터 응답 DTO를 생성한다.
     *
     * @param term Term 엔티티
     * @return TermResponse
     */
    public static TermResponse from(Term term) {
        final var domain = term.getDomain();
        return new TermResponse(
            term.getId(),
            term.getLogicalName(),
            term.getPhysicalName(),
            term.getDescription(),
            term.getTeam().getId(),
            term.getDictionarySet() != null ? term.getDictionarySet().getId() : null,
            domain != null ? domain.getId() : null,
            domain != null ? domain.getLogicalName() : null,
            term.getCreatedAt(),
            term.getUpdatedAt()
        );
    }
}
