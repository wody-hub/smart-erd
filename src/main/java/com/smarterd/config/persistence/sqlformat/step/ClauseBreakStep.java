package com.smarterd.config.persistence.sqlformat.step;

import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.AND;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.BY;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.CROSS;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.FROM;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.FULL;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.GROUP;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.HAVING;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.INNER;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.JOIN;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.LEFT;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.LIMIT;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.OFFSET;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.ON;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.OR;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.ORDER;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.OUTER;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.RETURNING;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.RIGHT;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.SET;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.UNION;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.VALUES;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.WHERE;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.phrase;

import com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword;
import com.smarterd.config.persistence.sqlformat.rule.RegexRule;
import java.util.List;

/**
 * 절 단위 줄바꿈을 적용해 SQL 로그 가독성을 높인다.
 *
 * <p>예: FROM/WHERE/JOIN/ON/AND/OR 키워드 앞 공백을 줄바꿈으로 치환한다.</p>
 */
public class ClauseBreakStep extends RegexRuleStep {

    private static final List<SqlKeyword.Phrase> CLAUSE_BREAK_PHRASES = List.of(
        phrase(FROM),
        phrase(GROUP, BY),
        phrase(HAVING),
        phrase(ORDER, BY),
        phrase(LIMIT),
        phrase(OFFSET),
        phrase(UNION, SqlKeyword.ALL),
        phrase(UNION),
        phrase(RETURNING),
        phrase(VALUES)
    );

    private static final List<SqlKeyword.Phrase> JOIN_BREAK_PHRASES = List.of(
        phrase(LEFT, OUTER, JOIN),
        phrase(RIGHT, OUTER, JOIN),
        phrase(FULL, OUTER, JOIN),
        phrase(LEFT, JOIN),
        phrase(RIGHT, JOIN),
        phrase(FULL, JOIN),
        phrase(INNER, JOIN),
        phrase(CROSS, JOIN),
        phrase(JOIN)
    );

    private static final List<RegexRule> RULES = List.of(
        // 기본 절(FROM/JOIN/VALUES 등)은 2칸 들여쓰기
        new RegexRule(SqlKeyword.leadingWhitespaceAlternationPattern(CLAUSE_BREAK_PHRASES), "\n  $1"),
        new RegexRule(SqlKeyword.leadingWhitespaceAlternationPattern(JOIN_BREAK_PHRASES), "\n  $1"),
        // 프로젝트 로그 스타일에 맞춰 WHERE/SET/ON은 별도 정렬 규칙을 사용한다.
        new RegexRule(SqlKeyword.leadingWhitespaceAlternationPattern(List.of(phrase(WHERE))), "\n $1"),
        new RegexRule(SqlKeyword.leadingWhitespaceAlternationPattern(List.of(phrase(SET))), "\n   $1"),
        new RegexRule(SqlKeyword.leadingWhitespaceAlternationPattern(List.of(phrase(ON))), "\n    $1"),
        // 논리 연산자(AND/OR)는 절보다 1칸 더 안쪽으로 들여쓰기
        new RegexRule(SqlKeyword.leadingWhitespaceAlternationPattern(List.of(phrase(AND))), "\n   $1"),
        new RegexRule(SqlKeyword.leadingWhitespaceAlternationPattern(List.of(phrase(OR))), "\n    $1")
    );

    /**
     * 절 줄바꿈 규칙 목록을 반환한다.
     *
     * @return 절 줄바꿈 규칙 목록
     */
    @Override
    protected List<RegexRule> rules() {
        return RULES;
    }
}
