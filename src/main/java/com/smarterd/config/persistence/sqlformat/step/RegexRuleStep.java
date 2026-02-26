package com.smarterd.config.persistence.sqlformat.step;

import com.smarterd.config.persistence.sqlformat.rule.RegexRule;
import java.util.List;

/**
 * RegexRule 목록을 순차 적용하는 공통 step 베이스.
 */
abstract class RegexRuleStep implements SqlFormatStep {

    /**
     * 구현체가 제공하는 정규식 치환 규칙 목록.
     *
     * @return 정규식 치환 규칙 목록
     */
    protected abstract List<RegexRule> rules();

    /**
     * 규칙 목록을 등록 순서대로 적용한다.
     *
     * @param sql 입력 SQL
     * @return 규칙 적용 결과 SQL
     */
    @Override
    public final String apply(String sql) {
        var result = sql;
        for (RegexRule rule : rules()) {
            result = rule.pattern().matcher(result).replaceAll(rule.replacement());
        }
        return result;
    }
}
