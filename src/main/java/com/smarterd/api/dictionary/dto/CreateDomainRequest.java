package com.smarterd.api.dictionary.dto;

import com.smarterd.utils.AppStringUtils;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * 도메인 생성 요청 DTO.
 *
 * @param domainGroup 도메인 그룹 (선택, 최대 100자)
 * @param domainClassification 도메인명 (선택, 최대 100자)
 * @param logicalName  공통 표준 도메인명 (필수, 1~100자)
 * @param physicalType 호환용 물리 데이터 타입 문자열 (선택, 최대 50자)
 * @param dataType 구조화 데이터 타입 (선택, 최대 50자)
 * @param dataLength 데이터 길이 (선택, 양수)
 * @param dataScale 데이터 소수점 길이 (선택, 0 이상)
 * @param description  설명 (선택, 최대 500자)
 */
@Schema(description = "도메인 생성 요청")
public record CreateDomainRequest(
    @Schema(description = "도메인 그룹", example = "명칭")
    @Size(max = 100, message = "{validation.size.domain-group}")
    String domainGroup,

    @Schema(description = "도메인명", example = "명")
    @Size(max = 100, message = "{validation.size.domain-classification}")
    String domainClassification,

    @Schema(description = "표준 도메인명 (1~100자)", example = "금액_DECIMAL15_2")
    @NotBlank(message = "{validation.not-blank.logical-name}")
    @Size(min = 1, max = 100, message = "{validation.size.logical-name}")
    String logicalName,

    @Schema(description = "호환용 물리 데이터 타입", example = "DECIMAL(15,2)", deprecated = true)
    @Size(min = 1, max = 50, message = "{validation.size.physical-type}")
    String physicalType,

    @Schema(description = "데이터 타입", example = "DECIMAL")
    @Size(min = 1, max = 50, message = "{validation.size.data-type}")
    String dataType,

    @Schema(description = "데이터 길이", example = "15")
    @Positive(message = "{validation.positive.data-length}")
    Integer dataLength,

    @Schema(description = "데이터 소수점 길이", example = "2")
    @PositiveOrZero(message = "{validation.non-negative.data-scale}")
    Integer dataScale,

    @Schema(description = "설명 (최대 500자)", example = "화폐 금액을 나타내는 타입")
    @Size(max = 500, message = "{validation.size.description}")
    String description
) {
    @AssertTrue(message = "{validation.domain-type.required}")
    public boolean isDomainTypeProvided() {
        return AppStringUtils.isNotBlank(this.dataType) || AppStringUtils.isNotBlank(this.physicalType);
    }

    @AssertTrue(message = "{validation.domain-scale.requires-length}")
    public boolean isDataScaleCompatible() {
        return this.dataScale == null || this.dataLength != null;
    }
}
