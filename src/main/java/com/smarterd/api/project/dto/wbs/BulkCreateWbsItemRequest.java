package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.springframework.lang.Nullable;

/**
 * WBS 대량 생성 단일 항목 요청.
 */
@Schema(description = "WBS 대량 생성 단일 항목")
public record BulkCreateWbsItemRequest(
    @NotBlank(message = "{validation.not-blank.wbs-client-key}")
    @Size(max = 64, message = "{validation.size.wbs-client-key}")
    @Schema(description = "배치 내부 stable key", example = "task-api-design")
    String clientKey,
    @Nullable @Schema(description = "기존 부모 WBS ID", example = "100") Long parentId,
    @Nullable
    @Size(max = 64, message = "{validation.size.wbs-client-key}")
    @Schema(description = "같은 요청 내 부모 clientKey", example = "phase-analysis")
    String parentClientKey,
    @NotBlank(message = "{validation.not-blank.wbs-name}")
    @Size(max = 200, message = "{validation.size.wbs-name}")
    @Schema(description = "WBS 항목명", example = "API 설계")
    String name,
    @Nullable @Schema(description = "담당자 사용자 ID", example = "3") Long assigneeUserId,
    @Nullable @Schema(description = "시작일", example = "2026-05-10") LocalDate startDate,
    @Nullable @Schema(description = "종료일", example = "2026-05-15") LocalDate endDate,
    @Nullable
    @Min(value = 0, message = "{validation.min.wbs-progress-rate}")
    @Max(value = 100, message = "{validation.max.wbs-progress-rate}")
    @Schema(description = "진척률", example = "0")
    Integer progressRate,
    @Nullable
    @DecimalMin(value = "0.0", message = "{validation.min.wbs-estimated-mm}")
    @Schema(description = "예상 M/M", example = "1.25")
    BigDecimal estimatedMm,
    @Nullable @Schema(description = "연결할 마일스톤 ID", example = "11") Long milestoneId
) {}
