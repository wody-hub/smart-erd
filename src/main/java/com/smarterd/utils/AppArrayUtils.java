package com.smarterd.utils;

import org.apache.commons.lang3.ArrayUtils;

/**
 * 애플리케이션 공통 배열 유틸리티.
 *
 * <p>기본 배열 처리는 Apache Commons {@link ArrayUtils}를 사용한다.</p>
 */
public final class AppArrayUtils {

    private AppArrayUtils() {}

    /**
     * 배열이 {@code null}이거나 비어 있으면 {@code true}를 반환한다.
     *
     * @param values 배열
     * @return 빈 배열 여부
     */
    public static boolean isEmpty(Object[] values) {
        return ArrayUtils.isEmpty(values);
    }
}
