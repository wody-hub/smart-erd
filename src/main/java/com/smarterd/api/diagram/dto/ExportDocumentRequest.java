package com.smarterd.api.diagram.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 문서 export 요청 DTO.
 *
 * @param format export 포맷 (`md`)
 */
@Schema(description = "문서 export 요청")
public record ExportDocumentRequest(
    @Schema(description = "export 포맷", example = "md")
    @NotBlank(message = "{validation.not-blank.export-format}")
    @Pattern(regexp = "md", message = "{validation.pattern.export-format}")
    String format
) {}
