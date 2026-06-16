package com.smarterd.api.project.dto.wbs;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.lang.Nullable;

/**
 * WBS 템플릿 저장 요청.
 */
@Schema(description = "WBS 템플릿 저장 요청")
public record SaveWbsTemplateRequest(
    @Schema(description = "스냅샷으로 저장할 subtree 루트 WBS ID", example = "101") Long sourceWbsItemId,
    @NotBlank(message = "{validation.not-blank.wbs-name}")
    @Size(max = 200, message = "{validation.size.wbs-name}")
    @Schema(description = "템플릿 이름", example = "기본 운영 wave")
    String name,
    @Nullable
    @Size(max = 1000, message = "{validation.size.wbs-template-description}")
    @Schema(description = "템플릿 설명", example = "반복 사용하는 운영형 작업 골격")
    String description
) {}
