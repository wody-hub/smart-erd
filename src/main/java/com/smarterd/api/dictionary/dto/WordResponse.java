package com.smarterd.api.dictionary.dto;

import com.smarterd.domain.dictionary.entity.Word;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * 단어 응답 DTO.
 */
@Schema(description = "단어 응답")
public record WordResponse(
    @Schema(description = "단어 ID", example = "1") Long id,
    @Schema(description = "논리명", example = "사용자") String logicalName,
    @Schema(description = "물리명", example = "user") String physicalName,
    @Schema(description = "설명") String description,
    @Schema(description = "소속 팀 ID", example = "1") Long teamId,
    @Schema(description = "소속 사전 세트 ID", example = "1") Long dictionarySetId,
    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,
    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    public static WordResponse from(Word word) {
        return new WordResponse(
            word.getId(),
            word.getLogicalName(),
            word.getPhysicalName(),
            word.getDescription(),
            word.getTeam().getId(),
            word.getDictionarySet() != null ? word.getDictionarySet().getId() : null,
            word.getCreatedAt(),
            word.getUpdatedAt()
        );
    }
}
