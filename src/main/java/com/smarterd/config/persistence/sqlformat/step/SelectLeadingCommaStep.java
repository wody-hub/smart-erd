package com.smarterd.config.persistence.sqlformat.step;

import com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword;
import com.smarterd.config.persistence.sqlformat.parser.SqlStructureParser;

/**
 * SELECT 절 컬럼 목록을 leading comma 스타일로 정렬한다.
 */
public class SelectLeadingCommaStep implements SqlFormatStep {

    private static final String SELECT_KEYWORD = SqlKeyword.SELECT.text();
    private static final String FROM_KEYWORD = SqlKeyword.FROM.text();

    /**
     * SELECT 절의 컬럼 목록을 leading comma 형태로 정렬한다.
     *
     * @param sql 입력 SQL
     * @return SELECT 컬럼 정렬이 적용된 SQL
     */
    @Override
    public String apply(String sql) {
        final var parser = new SqlStructureParser(sql);
        final var selectIdx = parser.indexOfTopLevelKeyword(SELECT_KEYWORD, 0);
        if (selectIdx < 0) {
            return sql;
        }

        final var fromIdx = parser.indexOfTopLevelKeyword(FROM_KEYWORD, selectIdx + SELECT_KEYWORD.length());
        // SELECT ~ FROM 구간만 추출해 top-level comma 기준으로 재정렬한다.
        return SqlClauseFormatSupport.formatCommaSeparatedClause(
            parser,
            selectIdx,
            SELECT_KEYWORD.length(),
            fromIdx,
            "SELECT ",
            "\n     , "
        );
    }
}
