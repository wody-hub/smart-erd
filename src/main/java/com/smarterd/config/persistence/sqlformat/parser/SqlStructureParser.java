package com.smarterd.config.persistence.sqlformat.parser;

import com.smarterd.config.persistence.sqlformat.SqlCharUtils;
import com.smarterd.utils.AppStringUtils;
import java.util.ArrayList;
import java.util.List;

/**
 * SQL 문자열에서 top-level 구조를 탐색하는 경량 파서.
 *
 * <p>AST를 구성하지 않고 다음 정보만 안전하게 추출한다.</p>
 * <p>1) top-level 키워드 위치, 2) top-level 특정 문자 위치, 3) 괄호 매칭, 4) top-level comma split</p>
 * <p>싱글 쿼트 문자열과 괄호 depth를 추적해 서브쿼리/함수 인자 내부는 건드리지 않는다.</p>
 */
public final class SqlStructureParser {

    private final String sql;

    /**
     * 원본 SQL 문자열로 파서를 생성한다.
     *
     * @param sql 원본 SQL 문자열
     */
    public SqlStructureParser(String sql) {
        this.sql = sql;
    }

    /**
     * 파서가 참조 중인 원본 SQL 문자열.
     *
     * @return 원본 SQL 문자열
     */
    public String rawSql() {
        return sql;
    }

    /**
     * 지정한 범위를 top-level comma 기준으로 분리한다.
     *
     * <p>괄호 내부/문자열 리터럴 내부 comma는 분리 대상으로 취급하지 않는다.</p>
     *
     * @param startInclusive 분리 시작 인덱스(포함)
     * @param endExclusive 분리 종료 인덱스(미포함)
     * @return 분리된 항목 목록
     */
    public List<String> splitTopLevelByComma(int startInclusive, int endExclusive) {
        if (startInclusive < 0 || endExclusive > sql.length() || startInclusive >= endExclusive) {
            return List.of();
        }

        final List<String> items = new ArrayList<>();
        final var current = new StringBuilder();
        var depth = 0;
        var inSingleQuote = false;

        for (var i = startInclusive; i < endExclusive; i++) {
            final var ch = sql.charAt(i);

            if (inSingleQuote) {
                current.append(ch);
                if (ch == '\'') {
                    // SQL 문자열 이스케이프('')는 그대로 유지하고 다음 문자까지 소비한다.
                    if (SqlCharUtils.isEscapedSingleQuote(sql, i)) {
                        current.append(sql.charAt(i + 1));
                        i++;
                    } else {
                        inSingleQuote = false;
                    }
                }
                continue;
            }

            if (ch == '\'') {
                inSingleQuote = true;
                current.append(ch);
                continue;
            }

            if (ch == '(') {
                depth++;
                current.append(ch);
                continue;
            }
            if (ch == ')') {
                if (depth > 0) {
                    depth--;
                }
                current.append(ch);
                continue;
            }

            if (ch == ',' && depth == 0) {
                // top-level comma만 항목 경계로 사용한다.
                items.add(AppStringUtils.trimToEmpty(current.toString()));
                current.setLength(0);
                continue;
            }

            current.append(ch);
        }

        final var last = AppStringUtils.trimToEmpty(current.toString());
        if (!last.isEmpty()) {
            items.add(last);
        }

        return items;
    }

    /**
     * top-level에서 키워드가 처음 등장하는 위치를 찾는다.
     *
     * <p>문자열 리터럴 내부, 괄호 내부(depth &gt; 0)는 탐색에서 제외한다.</p>
     *
     * @param keyword 찾을 키워드
     * @param start 탐색 시작 인덱스
     * @return 키워드 시작 인덱스. 없으면 -1
     */
    public int indexOfTopLevelKeyword(String keyword, int start) {
        final var keywordLength = keyword.length();
        final var startIndex = Math.max(start, 0);
        final var endExclusive = sql.length() - keywordLength + 1;
        if (startIndex >= endExclusive) {
            return -1;
        }

        return scanTopLevel(
            startIndex,
            endExclusive,
            (index, ch, depth) -> depth == 0 && matchesKeywordAt(sql, keyword, index)
        );
    }

    /**
     * top-level에서 지정한 문자가 처음 등장하는 위치를 찾는다.
     *
     * @param target 찾을 대상 문자
     * @param start 탐색 시작 인덱스
     * @return 문자 인덱스. 없으면 -1
     */
    public int findNextTopLevelChar(char target, int start) {
        return scanTopLevel(Math.max(start, 0), sql.length(), (index, ch, depth) -> ch == target && depth == 0);
    }

    /**
     * 지정한 여는 괄호 인덱스에 대응하는 닫는 괄호 인덱스를 찾는다.
     *
     * @param openParenIndex 여는 괄호 '(' 인덱스
     * @return 대응 닫는 괄호 ')' 인덱스. 없으면 -1
     */
    public int findMatchingParen(int openParenIndex) {
        if (openParenIndex < 0 || openParenIndex >= sql.length() || sql.charAt(openParenIndex) != '(') {
            return -1;
        }

        var depth = 0;
        var inSingleQuote = false;

        for (var i = openParenIndex; i < sql.length(); i++) {
            final var ch = sql.charAt(i);

            if (inSingleQuote) {
                if (ch == '\'') {
                    if (SqlCharUtils.isEscapedSingleQuote(sql, i)) {
                        i++;
                    } else {
                        inSingleQuote = false;
                    }
                }
                continue;
            }

            if (ch == '\'') {
                inSingleQuote = true;
                continue;
            }

            if (ch == '(') {
                depth++;
                continue;
            }

            if (ch == ')') {
                depth--;
                // openParenIndex에서 탐색을 시작했기 때문에 depth==0 시점이 대응 닫는 괄호다.
                if (depth == 0) {
                    return i;
                }
            }
        }

        return -1;
    }

    /**
     * 문자열 리터럴/괄호 depth를 고려하면서 top-level 문자만 순회하는 공통 스캐너.
     *
     * @param startInclusive 탐색 시작 인덱스(포함)
     * @param endExclusive 탐색 종료 인덱스(미포함)
     * @param matcher 현재 위치가 조건을 만족하는지 판별하는 콜백
     * @return 조건을 만족한 첫 인덱스. 없으면 -1
     */
    private int scanTopLevel(int startInclusive, int endExclusive, TopLevelMatcher matcher) {
        var depth = 0;
        var inSingleQuote = false;

        for (var i = startInclusive; i < endExclusive; i++) {
            final var ch = sql.charAt(i);

            if (inSingleQuote) {
                if (ch == '\'') {
                    if (SqlCharUtils.isEscapedSingleQuote(sql, i)) {
                        i++;
                    } else {
                        inSingleQuote = false;
                    }
                }
                continue;
            }

            if (ch == '\'') {
                inSingleQuote = true;
                continue;
            }

            if (ch == '(') {
                if (matcher.matches(i, ch, depth)) {
                    return i;
                }
                depth++;
                continue;
            }

            if (ch == ')') {
                if (depth > 0) {
                    depth--;
                }
                if (matcher.matches(i, ch, depth)) {
                    return i;
                }
                continue;
            }

            if (matcher.matches(i, ch, depth)) {
                return i;
            }
        }

        return -1;
    }

    /**
     * 키워드 경계 매칭(앞/뒤가 식별자 문자면 제외).
     *
     * @param sql 검사 대상 SQL
     * @param keyword 비교할 키워드
     * @param index 비교 시작 인덱스
     * @return 현재 위치가 키워드 경계 매칭이면 true
     */
    private static boolean matchesKeywordAt(String sql, String keyword, int index) {
        if (!sql.regionMatches(true, index, keyword, 0, keyword.length())) {
            return false;
        }

        if (index > 0) {
            final var before = sql.charAt(index - 1);
            if (Character.isLetterOrDigit(before) || before == '_') {
                return false;
            }
        }

        final var nextIndex = index + keyword.length();
        if (nextIndex < sql.length()) {
            final var after = sql.charAt(nextIndex);
            if (Character.isLetterOrDigit(after) || after == '_') {
                return false;
            }
        }

        return true;
    }

    @FunctionalInterface
    private interface TopLevelMatcher {
        /**
         * 현재 문자 위치가 찾고자 하는 타깃인지 판별한다.
         *
         * @param index 현재 인덱스
         * @param ch 현재 문자
         * @param depth 현재 괄호 depth
         * @return 타깃 조건 만족 여부
         */
        boolean matches(int index, char ch, int depth);
    }
}
