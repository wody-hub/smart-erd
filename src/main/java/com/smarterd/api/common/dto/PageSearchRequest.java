package com.smarterd.api.common.dto;

import io.swagger.v3.oas.annotations.Parameter;
import java.util.Objects;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.lang.Nullable;

/**
 * 페이지네이션 + 검색 공통 요청 DTO.
 *
 * <p>{@code @ModelAttribute}로 쿼리 파라미터를 자동 바인딩한다.</p>
 *
 * @param page    페이지 번호 (0-base, 기본값 0)
 * @param size    페이지 크기 (기본값 20, 최대 200)
 * @param keyword 복합 검색어 (nullable)
 */
public record PageSearchRequest(
    @Parameter(description = "페이지 번호 (0-base)") int page,
    @Parameter(description = "페이지 크기 (최대 200)") int size,
    @Nullable @Parameter(description = "복합 검색어") String keyword
) {
    /**
     * 기본값이 적용된 인스턴스를 생성한다.
     * Spring {@code @ModelAttribute} 바인딩 시 파라미터 미전달 시 기본값을 적용하기 위한 정적 팩토리.
     */
    public PageSearchRequest {
        // record compact constructor — 기본값은 Spring의 @RequestParam defaultValue 또는 컨트롤러에서 처리
    }

    /**
     * 페이지네이션 요청을 정규화하여 {@link PageRequest}를 생성한다.
     *
     * @param maxPageSize 최대 페이지 크기
     * @param sort        정렬 기준
     * @return 정규화된 PageRequest
     */
    public PageRequest toPageRequest(int maxPageSize, Sort sort) {
        final var normalizedPage = Math.max(page, 0);
        final var normalizedSize = Math.min(Math.max(size, 1), maxPageSize);
        return PageRequest.of(normalizedPage, normalizedSize, Objects.requireNonNull(sort));
    }

    /**
     * 검색 키워드를 정규화한다. 빈 문자열은 null로 변환한다.
     *
     * @return 정규화된 키워드 (null이면 전체 조회)
     */
    @Nullable
    public String normalizedKeyword() {
        if (keyword == null) {
            return null;
        }
        final var trimmed = keyword.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
