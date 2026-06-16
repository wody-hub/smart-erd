package com.smarterd.api.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.springframework.data.domain.Page;

/**
 * 페이지네이션 공통 응답 DTO.
 *
 * @param content       현재 페이지 데이터
 * @param page          현재 페이지 번호 (0-base)
 * @param size          페이지 크기
 * @param totalElements 전체 데이터 건수
 * @param totalPages    전체 페이지 수
 * @param first         첫 페이지 여부
 * @param last          마지막 페이지 여부
 * @param <T>           응답 데이터 타입
 */
@Schema(description = "페이지네이션 공통 응답")
public record PageResponse<T>(
    @Schema(description = "현재 페이지 데이터") List<T> content,

    @Schema(description = "현재 페이지 번호 (0-base)", example = "0") int page,

    @Schema(description = "페이지 크기", example = "20") int size,

    @Schema(description = "전체 데이터 건수", example = "120") long totalElements,

    @Schema(description = "전체 페이지 수", example = "6") int totalPages,

    @Schema(description = "첫 페이지 여부", example = "true") boolean first,

    @Schema(description = "마지막 페이지 여부", example = "false") boolean last
) {
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
            page.getContent(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages(),
            page.isFirst(),
            page.isLast()
        );
    }
}
