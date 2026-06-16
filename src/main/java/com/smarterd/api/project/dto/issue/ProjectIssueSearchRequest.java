package com.smarterd.api.project.dto.issue;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.issue.entity.ProjectIssuePriority;
import com.smarterd.domain.pm.issue.entity.ProjectIssueStatus;
import com.smarterd.utils.AppStringUtils;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.springframework.lang.Nullable;
import org.springframework.util.MultiValueMap;

/**
 * 프로젝트 이슈 검색 요청 DTO.
 */
@Schema(description = "프로젝트 이슈 검색 요청")
public record ProjectIssueSearchRequest(
    @Schema(description = "상태 필터", example = "REGISTERED") @Nullable ProjectIssueStatus status,
    @Schema(description = "상태 필터 목록(하위 호환)", example = "REGISTERED")
    @Nullable
    List<ProjectIssueStatus> statuses,
    @Schema(description = "우선순위 필터", example = "HIGH") @Nullable ProjectIssuePriority priority,
    @Schema(description = "우선순위 필터 목록(하위 호환)", example = "HIGH")
    @Nullable
    List<ProjectIssuePriority> priorities,
    @Schema(description = "담당자 사용자 ID 필터", example = "7") @Nullable Long assigneeUserId,
    @Schema(description = "담당자 사용자 ID 필터 목록(하위 호환)", example = "7") @Nullable List<Long> assigneeIds,
    @Schema(description = "미배정 이슈만 조회 여부", example = "false") boolean unassignedOnly,
    @Schema(description = "미배정 이슈 포함 여부(하위 호환)", example = "false") boolean includeUnassigned
) {
    /**
     * HTTP query parameter map을 이슈 검색 요청으로 변환한다.
     *
     * @param parameters HTTP query parameter map
     * @return 프로젝트 이슈 검색 요청
     */
    public static ProjectIssueSearchRequest fromParameters(MultiValueMap<String, String> parameters) {
        return new ProjectIssueSearchRequest(
            firstEnum(parameters, "status", ProjectIssueStatus.class),
            enumValues(parameters, "statuses", ProjectIssueStatus.class),
            firstEnum(parameters, "priority", ProjectIssuePriority.class),
            enumValues(parameters, "priorities", ProjectIssuePriority.class),
            firstLong(parameters, "assigneeUserId"),
            longValues(parameters, "assigneeIds"),
            booleanValue(parameters, "unassignedOnly"),
            booleanValue(parameters, "includeUnassigned")
        );
    }

    /**
     * 첫 번째 query parameter 값을 enum으로 변환한다.
     *
     * @param parameters query parameter map
     * @param name parameter 이름
     * @param enumType enum 타입
     * @return 변환된 enum 값 또는 null
     */
    private static <T extends Enum<T>> T firstEnum(
        MultiValueMap<String, String> parameters,
        String name,
        Class<T> enumType
    ) {
        final var value = AppStringUtils.trimToNull(firstValue(parameters, name));
        return value == null ? null : enumValue(value, enumType);
    }

    /**
     * query parameter 값 목록을 enum 목록으로 변환한다.
     *
     * @param parameters query parameter map
     * @param name parameter 이름
     * @param enumType enum 타입
     * @return 변환된 enum 목록
     */
    private static <T extends Enum<T>> List<T> enumValues(
        MultiValueMap<String, String> parameters,
        String name,
        Class<T> enumType
    ) {
        return values(parameters, name)
            .stream()
            .map(AppStringUtils::trimToNull)
            .filter(AppStringUtils::isNotBlank)
            .map((value) -> enumValue(value, enumType))
            .toList();
    }

    /**
     * 문자열 값을 enum 값으로 변환한다.
     *
     * @param value 문자열 값
     * @param enumType enum 타입
     * @param <T> enum 타입
     * @return 변환된 enum 값
     */
    private static <T extends Enum<T>> T enumValue(String value, Class<T> enumType) {
        try {
            return Enum.valueOf(enumType, value);
        } catch (IllegalArgumentException exception) {
            throw invalidSearchParameter();
        }
    }

    /**
     * 첫 번째 query parameter 값을 Long으로 변환한다.
     *
     * @param parameters query parameter map
     * @param name parameter 이름
     * @return 변환된 Long 값 또는 null
     */
    private static Long firstLong(MultiValueMap<String, String> parameters, String name) {
        final var value = AppStringUtils.trimToNull(firstValue(parameters, name));
        return value == null ? null : longValue(value);
    }

    /**
     * query parameter 값 목록을 Long 목록으로 변환한다.
     *
     * @param parameters query parameter map
     * @param name parameter 이름
     * @return 변환된 Long 목록
     */
    private static List<Long> longValues(MultiValueMap<String, String> parameters, String name) {
        return values(parameters, name)
            .stream()
            .map(AppStringUtils::trimToNull)
            .filter(AppStringUtils::isNotBlank)
            .map(ProjectIssueSearchRequest::longValue)
            .toList();
    }

    /**
     * 문자열 값을 Long으로 변환한다.
     *
     * @param value 문자열 값
     * @return 변환된 Long 값
     */
    private static Long longValue(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException exception) {
            throw invalidSearchParameter();
        }
    }

    /**
     * 첫 번째 query parameter 값을 boolean으로 변환한다.
     *
     * @param parameters query parameter map
     * @param name parameter 이름
     * @return 변환된 boolean 값
     */
    private static boolean booleanValue(MultiValueMap<String, String> parameters, String name) {
        final var value = AppStringUtils.trimToNull(firstValue(parameters, name));
        return value != null && Boolean.parseBoolean(value);
    }

    /**
     * 첫 번째 query parameter 값을 반환한다.
     *
     * @param parameters query parameter map
     * @param name parameter 이름
     * @return 첫 번째 값 또는 null
     */
    private static String firstValue(MultiValueMap<String, String> parameters, String name) {
        return parameters.getFirst(name);
    }

    /**
     * query parameter 값 목록을 반환한다.
     *
     * @param parameters query parameter map
     * @param name parameter 이름
     * @return 값 목록
     */
    private static List<String> values(MultiValueMap<String, String> parameters, String name) {
        final var values = parameters.get(name);
        return values == null ? List.of() : values;
    }

    /**
     * 유효하지 않은 검색 파라미터 예외를 생성한다.
     *
     * @return validation 실패 예외
     */
    private static BusinessException invalidSearchParameter() {
        return new BusinessException(MessageCode.ERROR_VALIDATION_FAILED.code());
    }
}
