package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.dictionary.service.BulkModels.BulkValidationRowResult;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 벌크 검증 프리뷰 행 병합 규칙을 제공한다.
 */
final class BulkValidationPreviewSupport {

    private BulkValidationPreviewSupport() {}

    /**
     * 에러 행을 우선 보존하면서 유효 행을 남은 슬롯만큼 채운다.
     *
     * @param errorPreviewRows 에러 프리뷰 행 목록
     * @param validPreviewRows 유효 프리뷰 행 목록
     * @param limit 프리뷰 최대 행 수
     * @return 행 번호순으로 정렬된 프리뷰 행 목록
     */
    static List<BulkValidationRowResult> mergePreviewRows(
        List<BulkValidationRowResult> errorPreviewRows,
        List<BulkValidationRowResult> validPreviewRows,
        int limit
    ) {
        if (errorPreviewRows.size() >= limit) {
            return List.copyOf(errorPreviewRows);
        }
        final var merged = new ArrayList<BulkValidationRowResult>(
            Math.min(limit, errorPreviewRows.size() + validPreviewRows.size())
        );
        merged.addAll(errorPreviewRows);
        final var remaining = limit - merged.size();
        if (remaining > 0) {
            merged.addAll(validPreviewRows.stream().limit(remaining).toList());
        }
        merged.sort(Comparator.comparingInt(BulkValidationRowResult::rowNumber));
        return List.copyOf(merged);
    }
}
