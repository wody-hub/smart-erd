package com.smarterd.domain.dictionary.service;

import com.smarterd.utils.AppStringUtils;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * 논리명 기반 배치 조회 공통 로직을 제공한다.
 */
final class BulkLogicalNameLookupSupport {

    private BulkLogicalNameLookupSupport() {}

    /**
     * 논리명 목록을 정규화하고 배치 단위로 기존 엔티티를 조회한다.
     *
     * @param logicalNames 조회 대상 논리명 목록
     * @param batchSize 배치 크기
     * @param chunkFetcher 배치 조회 함수
     * @param nameExtractor 엔티티에서 논리명을 추출하는 함수
     * @param <T> 조회 대상 타입
     * @return 논리명 기준 기존 엔티티 맵
     */
    static <T> Map<String, T> findExistingByLogicalNames(
        List<String> logicalNames,
        int batchSize,
        Function<List<String>, List<T>> chunkFetcher,
        Function<T, String> nameExtractor
    ) {
        final var normalized = logicalNames
            .stream()
            .map(AppStringUtils::trimToEmpty)
            .filter(AppStringUtils::isNotBlank)
            .distinct()
            .toList();
        if (normalized.isEmpty()) {
            return Map.of();
        }

        final var existingByLogicalName = new LinkedHashMap<String, T>();
        for (var start = 0; start < normalized.size(); start += batchSize) {
            final var end = Math.min(start + batchSize, normalized.size());
            final var chunk = chunkFetcher.apply(normalized.subList(start, end));
            for (final var entity : chunk) {
                existingByLogicalName.putIfAbsent(nameExtractor.apply(entity), entity);
            }
        }
        return Map.copyOf(existingByLogicalName);
    }
}
