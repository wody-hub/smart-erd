package com.smarterd.config.persistence.sqlformat.step;

import com.smarterd.config.persistence.sqlformat.parser.SqlStructureParser;
import java.util.List;

/**
 * SELECT/SET/INSERT 영역의 leading-comma 정렬 공통 유틸.
 */
final class SqlClauseFormatSupport {

    /** 유틸 클래스 인스턴스화 방지 */
    private SqlClauseFormatSupport() {}

    /**
     * 키워드 뒤 comma-separated 구간을 leading comma 형식으로 재정렬한다.
     *
     * @param parser SQL 구조 파서
     * @param clauseIdx 정렬 대상 키워드 시작 인덱스
     * @param keywordLength 키워드 길이
     * @param blockEndIdx 정렬 대상 구간 종료 인덱스
     * @param firstPrefix 첫 항목 prefix
     * @param commaPrefix 두 번째 항목부터 사용할 prefix
     * @return 정렬 후 SQL
     */
    static String formatCommaSeparatedClause(
        SqlStructureParser parser,
        int clauseIdx,
        int keywordLength,
        int blockEndIdx,
        String firstPrefix,
        String commaPrefix
    ) {
        final var sql = parser.rawSql();
        if (clauseIdx < 0 || blockEndIdx <= clauseIdx) {
            return sql;
        }

        // 예: SELECT a, b, c -> SELECT a \n , b \n , c
        final var items = parser.splitTopLevelByComma(clauseIdx + keywordLength, blockEndIdx);
        if (items.size() <= 1) {
            return sql;
        }

        final var formatted = buildLeadingCommaList(items, firstPrefix, commaPrefix, true);
        final var prefixBeforeNextClause = leadingWhitespaceBefore(sql, blockEndIdx);
        return sql.substring(0, clauseIdx) + formatted + prefixBeforeNextClause + sql.substring(blockEndIdx);
    }

    /**
     * 괄호 내부 comma 리스트를 leading comma 형식으로 정렬한다.
     *
     * @param items 정렬 대상 항목 목록
     * @param firstIndent 첫 항목 들여쓰기 수
     * @param commaIndent comma 행 들여쓰기 수
     * @return 포맷팅된 괄호 리스트 문자열
     */
    static String formatParenthesizedLeadingCommaList(List<String> items, int firstIndent, int commaIndent) {
        if (items.isEmpty()) {
            return "()";
        }

        // 예: (a, b, c) -> (
        //       a
        //     , b
        //     , c
        // )
        final var firstPad = " ".repeat(Math.max(firstIndent, 0));
        final var commaPad = " ".repeat(Math.max(commaIndent, 0));
        final var body = buildLeadingCommaList(items, "(\n" + firstPad, "\n" + commaPad + ", ", false);
        return body + "\n)";
    }

    /**
     * 항목 목록을 leading comma 스타일 문자열로 조합한다.
     *
     * @param items 조합할 항목 목록
     * @param firstPrefix 첫 항목 prefix
     * @param commaPrefix 두 번째 항목부터 사용할 prefix
     * @param appendTrailingNewline 끝에 개행을 추가할지 여부
     * @return 조합된 문자열
     */
    private static String buildLeadingCommaList(
        List<String> items,
        String firstPrefix,
        String commaPrefix,
        boolean appendTrailingNewline
    ) {
        // 첫 항목은 prefix와 함께 두고, 이후 항목은 commaPrefix를 사용해 줄맞춤한다.
        final var builder = new StringBuilder(firstPrefix).append(items.get(0).trim());
        for (var i = 1; i < items.size(); i++) {
            builder.append(commaPrefix).append(items.get(i).trim());
        }
        if (appendTrailingNewline) {
            builder.append("\n");
        }
        return builder.toString();
    }

    /**
     * 기준 인덱스 바로 앞 줄의 공백 prefix를 추출한다.
     *
     * <p>예: "\n  WHERE"에서 WHERE 인덱스를 넣으면 "  "를 반환한다.</p>
     *
     * @param text 검사 대상 문자열
     * @param index 기준 인덱스(해당 위치 문자 직전 구간을 검사)
     * @return 줄 시작 공백 prefix. 없으면 빈 문자열
     */
    private static String leadingWhitespaceBefore(String text, int index) {
        final var builder = new StringBuilder();
        var i = index - 1;

        while (i >= 0) {
            final var ch = text.charAt(i);
            if (ch == ' ' || ch == '\t') {
                builder.append(ch);
                i--;
                continue;
            }
            if (ch == '\n' || ch == '\r') {
                return builder.reverse().toString();
            }
            return "";
        }

        return "";
    }
}
