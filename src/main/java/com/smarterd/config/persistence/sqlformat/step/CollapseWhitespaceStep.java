package com.smarterd.config.persistence.sqlformat.step;

import com.smarterd.config.persistence.sqlformat.SqlCharUtils;
import com.smarterd.utils.AppStringUtils;

/**
 * 문자열 리터럴 외부의 연속 공백을 1칸으로 축약한다.
 *
 * <p>SQL 토큰 경계를 단순화해서 후속 정규식/파서 단계가 안정적으로 동작하도록 만든다.</p>
 */
public class CollapseWhitespaceStep implements SqlFormatStep {

    /**
     * 문자열 리터럴 바깥의 연속 공백을 단일 공백으로 축약한다.
     *
     * @param sql 입력 SQL
     * @return 공백 정리된 SQL
     */
    @Override
    public String apply(String sql) {
        final var result = new StringBuilder(sql.length());
        var inSingleQuote = false;
        var previousWhitespace = false;

        for (var i = 0; i < sql.length(); i++) {
            final var ch = sql.charAt(i);

            if (inSingleQuote) {
                result.append(ch);
                if (ch == '\'') {
                    // ''는 SQL 문자열 이스케이프이므로 둘 다 유지한다.
                    if (SqlCharUtils.isEscapedSingleQuote(sql, i)) {
                        result.append(sql.charAt(i + 1));
                        i++;
                    } else {
                        inSingleQuote = false;
                    }
                }
                continue;
            }

            if (ch == '\'') {
                inSingleQuote = true;
                result.append(ch);
                previousWhitespace = false;
                continue;
            }

            if (Character.isWhitespace(ch)) {
                if (!previousWhitespace) {
                    result.append(' ');
                    previousWhitespace = true;
                }
                continue;
            }

            result.append(ch);
            previousWhitespace = false;
        }

        return AppStringUtils.trimToEmpty(result.toString());
    }
}
