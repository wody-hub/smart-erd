package com.smarterd.config.persistence.sqlformat.step;

import com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword;
import com.smarterd.config.persistence.sqlformat.parser.SqlStructureParser;

/**
 * UPDATE ... SET 할당 목록을 leading comma 스타일로 정렬한다.
 */
public class UpdateSetLeadingCommaStep implements SqlFormatStep {

    private static final String SET_KEYWORD = SqlKeyword.SET.text();
    private static final String WHERE_KEYWORD = SqlKeyword.WHERE.text();
    private static final String RETURNING_KEYWORD = SqlKeyword.RETURNING.text();

    /**
     * UPDATE ... SET 할당 목록을 leading comma 형태로 정렬한다.
     *
     * @param sql 입력 SQL
     * @return UPDATE SET 정렬이 적용된 SQL
     */
    @Override
    public String apply(String sql) {
        final var parser = new SqlStructureParser(sql);
        final var setIdx = parser.indexOfTopLevelKeyword(SET_KEYWORD, 0);
        if (setIdx < 0) {
            return sql;
        }

        final var whereIdx = parser.indexOfTopLevelKeyword(WHERE_KEYWORD, setIdx + SET_KEYWORD.length());
        final var returningIdx = parser.indexOfTopLevelKeyword(RETURNING_KEYWORD, setIdx + SET_KEYWORD.length());
        // SET 구간의 종료 지점은 WHERE/RETURNING 중 먼저 나오는 위치다.
        final var endIdx = minPositive(sql.length(), whereIdx, returningIdx);

        return SqlClauseFormatSupport.formatCommaSeparatedClause(
            parser,
            setIdx,
            SET_KEYWORD.length(),
            endIdx,
            "SET ",
            "\n    , "
        );
    }

    /**
     * 0 이상 값 중 최소값을 반환한다.
     *
     * @param defaultValue 후보가 없을 때 반환할 기본값
     * @param values 비교 대상 값 목록
     * @return 0 이상 최소값 또는 기본값
     */
    private static int minPositive(int defaultValue, int... values) {
        var result = defaultValue;
        for (int value : values) {
            if (value >= 0 && value < result) {
                result = value;
            }
        }
        return result;
    }
}
