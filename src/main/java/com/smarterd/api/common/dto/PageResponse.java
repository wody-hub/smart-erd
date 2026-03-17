package com.smarterd.api.common.dto;

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
public record PageResponse<T>(
    List<T> content,
    int page,
    int size,
    long totalElements,
    int totalPages,
    boolean first,
    boolean last
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
