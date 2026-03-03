package com.smarterd.config.persistence;

import com.p6spy.engine.spy.appender.MessageFormattingStrategy;
import com.smarterd.config.persistence.sqlformat.SqlFormatPipeline;
import com.smarterd.config.persistence.sqlformat.SqlFormatPipelineFactory;
import com.smarterd.config.persistence.sqlformat.SqlFormatProfile;
import com.smarterd.utils.AppStringUtils;

/**
 * p6spy의 MessageFormattingStrategy 진입점.
 *
 * <p>이 클래스는 "어댑터" 역할만 담당하고, 실제 SQL 가공 로직은
 * {@code com.smarterd.config.persistence.sqlformat} 패키지의 파이프라인으로 위임한다.
 * 결과적으로 spy.properties의 기존 진입 클래스명은 유지하면서 내부 구현은 단계별 확장이 가능하다.</p>
 */
public class PrettySqlFormat implements MessageFormattingStrategy {

    /** 현재 서비스 기본 SQL 로그 스타일(LEADING_COMMA 프로필) 파이프라인 */
    private static final SqlFormatPipeline PIPELINE = SqlFormatPipelineFactory.create(SqlFormatProfile.LEADING_COMMA);

    /**
     * p6spy 콜백 진입점에서 SQL 로그 문자열을 가공한다.
     *
     * @param connectionId p6spy 연결 식별자
     * @param now 로그 시각 문자열
     * @param elapsed SQL 실행 시간(ms)
     * @param category p6spy 카테고리(statement, resultset 등)
     * @param prepared prepared SQL 원문
     * @param sql 실제 실행 SQL
     * @param url JDBC URL
     * @return 포맷된 로그 문자열. sql이 비어있으면 빈 문자열
     */
    @Override
    public String formatMessage(
        int connectionId,
        String now,
        long elapsed,
        String category,
        String prepared,
        String sql,
        String url
    ) {
        if (AppStringUtils.isBlank(sql)) {
            return "";
        }

        // 실제 SQL 변환은 CoR 파이프라인에 위임한다.
        final var prettySql = PIPELINE.format(sql);
        return String.format("%n| %d ms | %s |%n%s", elapsed, category, prettySql);
    }
}
