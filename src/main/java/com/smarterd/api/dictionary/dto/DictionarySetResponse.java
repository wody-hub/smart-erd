package com.smarterd.api.dictionary.dto;

import com.smarterd.domain.dictionary.entity.DictionarySet;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * 사전 세트 응답 DTO.
 *
 * @param id          세트 ID
 * @param name        세트 이름
 * @param description 설명
 * @param teamId      소속 팀 ID
 * @param isDefault   기본 세트 여부
 * @param createdAt   생성 시각
 * @param updatedAt   수정 시각
 */
@Schema(description = "사전 세트 응답")
public record DictionarySetResponse(
    @Schema(description = "세트 ID", example = "1") Long id,
    @Schema(description = "세트 이름", example = "Default") String name,
    @Schema(description = "설명") String description,
    @Schema(description = "소속 팀 ID", example = "1") Long teamId,
    @Schema(description = "기본 세트 여부", example = "true") boolean isDefault,
    @Schema(description = "생성 시각 (UTC, ISO-8601)") Instant createdAt,
    @Schema(description = "수정 시각 (UTC, ISO-8601)") Instant updatedAt
) {
    public static DictionarySetResponse from(DictionarySet dictionarySet) {
        return new DictionarySetResponse(
            dictionarySet.getId(),
            dictionarySet.getName(),
            dictionarySet.getDescription(),
            dictionarySet.getTeam().getId(),
            dictionarySet.isDefault(),
            dictionarySet.getCreatedAt(),
            dictionarySet.getUpdatedAt()
        );
    }
}
