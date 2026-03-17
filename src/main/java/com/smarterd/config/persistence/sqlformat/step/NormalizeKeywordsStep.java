package com.smarterd.config.persistence.sqlformat.step;

import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.ALL;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.AND;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.BY;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.CROSS;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.DELETE;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.FROM;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.FULL;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.GROUP;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.HAVING;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.INNER;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.INSERT;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.INTO;
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
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.SELECT;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.SET;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.UNION;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.UPDATE;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.VALUES;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.WHERE;
import static com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword.phrase;

import com.smarterd.config.persistence.sqlformat.keyword.SqlKeyword;
import com.smarterd.config.persistence.sqlformat.rule.RegexRule;
import java.util.ArrayList;
import java.util.List;

/**
 * SQL 키워드를 표준 대문자 표기로 정규화한다.
 *
 * <p>멀티워드 키워드(LEFT JOIN 등)를 먼저 치환한 뒤 단일 키워드를 치환해
 * 부분 매칭으로 인한 깨짐을 방지한다.</p>
 */
public class NormalizeKeywordsStep extends RegexRuleStep {

    private static final List<SqlKeyword.Phrase> MULTI_WORD_NORMALIZE_PHRASES = List.of(
        phrase(LEFT, OUTER, JOIN),
        phrase(RIGHT, OUTER, JOIN),
        phrase(FULL, OUTER, JOIN),
        phrase(UNION, ALL),
        phrase(GROUP, BY),
        phrase(ORDER, BY),
        phrase(INSERT, INTO),
        phrase(DELETE, FROM),
        phrase(LEFT, JOIN),
        phrase(RIGHT, JOIN),
        phrase(INNER, JOIN),
        phrase(FULL, JOIN),
        phrase(CROSS, JOIN)
    );

    private static final List<SqlKeyword.Phrase> SINGLE_WORD_NORMALIZE_PHRASES = SqlKeyword.singleWordPhrases(
        SELECT,
        FROM,
        WHERE,
        JOIN,
        LEFT,
        RIGHT,
        FULL,
        OUTER,
        INNER,
        CROSS,
        ON,
        AND,
        OR,
        INSERT,
        INTO,
        DELETE,
        UPDATE,
        SET,
        VALUES,
        HAVING,
        LIMIT,
        OFFSET,
        UNION,
        RETURNING
    );

    private static final List<RegexRule> RULES = buildRules();

    /**
     * 키워드 정규화 규칙 목록을 반환한다.
     *
     * @return 키워드 정규화 규칙 목록
     */
    @Override
    protected List<RegexRule> rules() {
        return RULES;
    }

    /**
     * 멀티워드/단일워드 정규화 규칙을 구성한다.
     *
     * @return 정규화 규칙 목록
     */
    private static List<RegexRule> buildRules() {
        final List<RegexRule> rules = new ArrayList<>();

        for (SqlKeyword.Phrase phrase : MULTI_WORD_NORMALIZE_PHRASES) {
            rules.add(new RegexRule(phrase.wordBoundaryPattern(), phrase.text()));
        }

        for (SqlKeyword.Phrase phrase : SINGLE_WORD_NORMALIZE_PHRASES) {
            rules.add(new RegexRule(phrase.wordBoundaryPattern(), phrase.text()));
        }

        return List.copyOf(rules);
    }
}
