package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * dependency shift preview/apply 요청.
 */
@Schema(description = "dependency shift preview/apply 요청")
public record WbsDependencyShiftRequest(
    @Valid @NotEmpty @Schema(description = "사용자가 직접 이동한 anchor 목록") List<WbsDependencyShiftItemRequest> anchors
) {}
