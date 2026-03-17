package com.smarterd.config.persistence.sqlformat;

/**
 * SQL 포맷 파이프라인 프로필.
 *
 * <p>향후 로그 스타일이 늘어날 경우(예: COMPACT, DEBUG) 팩토리 분기점으로 사용한다.</p>
 */
public enum SqlFormatProfile {
    /**
     * Leading comma 스타일: SELECT/UPDATE SET/INSERT 절의 항목을 줄 앞 콤마로 정렬한다.
     *
     * <p>파이프라인 순서: 공백 정리 -> 키워드 정규화 -> 절 개행 -> 구문별 leading comma 정렬</p>
     */
    LEADING_COMMA,
}
