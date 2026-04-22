package com.smarterd.api.project.dto.milestone;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import org.springframework.lang.Nullable;

/**
 * 마일스톤 생성 요청 DTO.
 */
@Schema(description = "마일스톤 생성 요청")
public record CreateMilestoneRequest(
    @Schema(description = "마일스톤 이름", example = "요구사항 확정")
    @NotBlank(message = "{validation.not-blank.milestone-name}")
    @Size(max = 200, message = "{validation.size.milestone-name}")
    String name,

    @Schema(description = "목표일", example = "2026-05-31")
    @NotNull(message = "{validation.not-null.milestone-target-date}")
    LocalDate targetDate,

    @Schema(description = "설명", example = "분석 산출물 완료")
    @Nullable
    @Size(max = 2000, message = "{validation.size.milestone-description}")
    String description
) {}
