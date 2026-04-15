package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.springframework.lang.Nullable;

/**
 * WBS 항목 수정 요청 DTO.
 */
@Schema(description = "WBS 항목 수정 요청")
public record UpdateWbsItemRequest(
    @Schema(description = "WBS 항목명", example = "요구사항 분석")
    @NotBlank(message = "{validation.not-blank.wbs-name}")
    @Size(max = 200, message = "{validation.size.wbs-name}")
    String name,

    @Schema(description = "담당자 사용자 ID", example = "3") @Nullable Long assigneeUserId,

    @Schema(description = "시작일", example = "2026-04-20") @Nullable LocalDate startDate,

    @Schema(description = "종료일", example = "2026-04-30") @Nullable LocalDate endDate,

    @Schema(description = "진척률 (0~100)", example = "20")
    @Nullable
    @Min(value = 0, message = "{validation.min.wbs-progress-rate}")
    @Max(value = 100, message = "{validation.max.wbs-progress-rate}")
    Integer progressRate,

    @Schema(description = "예상 M/M", example = "1.50")
    @Nullable
    @DecimalMin(value = "0.0", message = "{validation.min.wbs-estimated-mm}")
    BigDecimal estimatedMm,

    @Schema(description = "연결할 마일스톤 ID", example = "10") @Nullable Long milestoneId
) {
    @AssertTrue(message = "{validation.wbs-period.invalid}")
    public boolean isPeriodValid() {
        return startDate == null || endDate == null || !startDate.isAfter(endDate);
    }
}
