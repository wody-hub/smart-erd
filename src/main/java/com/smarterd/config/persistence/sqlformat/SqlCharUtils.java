package com.smarterd.config.persistence.sqlformat;

/**
 * SQL 문자 수준 유틸리티 메서드 모음.
 *
 * <p>SQL 파서/포맷 단계에서 공통으로 사용하는 문자 판별 로직을 한 곳에 모은다.</p>
 */
public final class SqlCharUtils {

    private SqlCharUtils() {}

    /**
     * SQL 문자열에서 {@code ''} 형태 이스케이프 여부를 판별한다.
     *
     * <p>현재 인덱스의 문자가 {@code '} 이고, 바로 다음 문자도 {@code '} 이면
     * SQL 표준 문자열 이스케이프({@code ''})로 판정한다.</p>
     *
     * @param text  검사 대상 문자열
     * @param index 현재 인덱스 (싱글 쿼트 위치)
     * @return {@code ''} 이스케이프 시작이면 {@code true}
     */
    public static boolean isEscapedSingleQuote(String text, int index) {
        return index + 1 < text.length() && text.charAt(index) == '\'' && text.charAt(index + 1) == '\'';
    }
}
