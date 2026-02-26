package com.smarterd.config.persistence.sqlformat;

import com.smarterd.config.persistence.sqlformat.step.SqlFormatStep;
import java.util.List;
import java.util.Objects;

/**
 * SQL 문자열을 단계별로 변환하는 CoR(Chain of Responsibility) 파이프라인.
 *
 * <p>각 스텝은 입력 문자열을 받아 변환 결과를 반환하고,
 * 파이프라인은 그 결과를 다음 스텝에 순차 전달한다.</p>
 */
public final class SqlFormatPipeline {

    private final List<SqlFormatStep> steps;

    /**
     * 포맷 스텝 목록으로 파이프라인을 구성한다.
     *
     * <p>입력 리스트와 각 스텝은 null이 허용되지 않는다.</p>
     *
     * @param steps 순차 적용할 포맷 스텝 목록
     */
    public SqlFormatPipeline(List<SqlFormatStep> steps) {
        final var copied = List.copyOf(Objects.requireNonNull(steps, "steps must not be null"));
        for (SqlFormatStep step : copied) {
            Objects.requireNonNull(step, "step must not be null");
        }
        this.steps = copied;
    }

    /**
     * 등록된 스텝 순서대로 SQL을 가공한다.
     *
     * <p>마지막에 trim()을 수행해 로그 출력 시 앞/뒤 불필요 공백을 제거한다.</p>
     *
     * @param sql 원본 SQL 문자열
     * @return 단계별 규칙이 적용된 SQL 문자열
     */
    public String format(String sql) {
        var result = Objects.requireNonNull(sql, "sql must not be null");
        for (SqlFormatStep step : steps) {
            result = step.apply(result);
        }
        return result.trim();
    }
}
