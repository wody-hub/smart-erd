package com.smarterd.api.project.dto.wbs;

import com.smarterd.domain.pm.wbs.entity.WbsDependencyType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * WBS dependency 생성 요청 DTO.
 */
@Schema(description = "WBS dependency 생성 요청")
public record CreateWbsDependencyRequest(
    @Schema(description = "선행 WBS 항목 ID", example = "100")
    @NotNull(message = "{validation.not-null.wbs-dependency.predecessor}")
    Long predecessorWbsItemId,

    @Schema(description = "후행 WBS 항목 ID", example = "101")
    @NotNull(message = "{validation.not-null.wbs-dependency.successor}")
    Long successorWbsItemId,

    @Schema(description = "dependency 타입", example = "FS")
    @NotNull(message = "{validation.not-null.wbs-dependency.type}")
    WbsDependencyType dependencyType
) {}
