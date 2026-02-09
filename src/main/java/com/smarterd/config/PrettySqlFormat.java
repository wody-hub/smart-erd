package com.smarterd.config;

import com.p6spy.engine.spy.appender.MessageFormattingStrategy;
import org.hibernate.engine.jdbc.internal.FormatStyle;

/**
 * p6spy SQL 로그를 보기 좋게 포맷하는 전략.
 * Hibernate {@link FormatStyle#BASIC}을 사용하여 SQL에 들여쓰기와 줄바꿈을 적용한다.
 */
public class PrettySqlFormat implements MessageFormattingStrategy {

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
        if (sql == null || sql.isBlank()) {
            return "";
        }
        return String.format("\n| %d ms | %s |%s", elapsed, category, FormatStyle.BASIC.getFormatter().format(sql));
    }
}
