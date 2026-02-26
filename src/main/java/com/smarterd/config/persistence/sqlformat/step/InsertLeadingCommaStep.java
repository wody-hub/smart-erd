package com.smarterd.config.persistence.sqlformat.step;

import com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword;
import com.smarterd.config.persistence.sqlformat.parser.SqlStructureParser;

/**
 * INSERT 구문의 컬럼 목록과 VALUES 목록을 leading comma 스타일로 정렬한다.
 */
public class InsertLeadingCommaStep implements SqlFormatStep {

    private static final String INSERT_INTO_KEYWORD = SqlKeyword.phrase(SqlKeyword.INSERT, SqlKeyword.INTO).text();
    private static final String VALUES_KEYWORD = SqlKeyword.VALUES.text();

    /**
     * INSERT 구문의 컬럼/값 리스트를 leading comma 형태로 정렬한다.
     *
     * @param sql 입력 SQL
     * @return INSERT 리스트 정렬이 적용된 SQL
     */
    @Override
    public String apply(String sql) {
        final var parser = new SqlStructureParser(sql);
        final var insertIdx = parser.indexOfTopLevelKeyword(INSERT_INTO_KEYWORD, 0);
        if (insertIdx < 0) {
            return sql;
        }

        final var columnsOpen = parser.findNextTopLevelChar('(', insertIdx);
        if (columnsOpen < 0) {
            return sql;
        }

        final var columnsClose = parser.findMatchingParen(columnsOpen);
        if (columnsClose < 0) {
            return sql;
        }

        final var valuesIdx = parser.indexOfTopLevelKeyword(VALUES_KEYWORD, columnsClose);
        if (valuesIdx < 0) {
            return sql;
        }

        final var valuesOpen = parser.findNextTopLevelChar('(', valuesIdx);
        if (valuesOpen < 0) {
            return sql;
        }

        final var valuesClose = parser.findMatchingParen(valuesOpen);
        if (valuesClose < 0) {
            return sql;
        }

        // 컬럼/값을 각각 분리해 같은 포맷 규칙으로 정렬한다.
        final var columnItems = parser.splitTopLevelByComma(columnsOpen + 1, columnsClose);
        final var valueItems = parser.splitTopLevelByComma(valuesOpen + 1, valuesClose);

        final var formattedColumns = SqlClauseFormatSupport.formatParenthesizedLeadingCommaList(columnItems, 4, 2);
        final var formattedValues = SqlClauseFormatSupport.formatParenthesizedLeadingCommaList(valueItems, 4, 2);

        return sql.substring(0, columnsOpen)
            + formattedColumns
            + sql.substring(columnsClose + 1, valuesOpen)
            + formattedValues
            + sql.substring(valuesClose + 1);
    }
}
