package com.smarterd.config.persistence.sqlformat.keyword;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * SQL 키워드를 단일 토큰 단위로 관리하고, 여러 키워드 조합(phrase) 생성 유틸을 제공한다.
 */
public enum SqlKeyword {
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
    RETURNING,
    ALL,
    GROUP,
    ORDER,
    BY;

    /**
     * enum 이름을 SQL 키워드 문자열로 반환한다.
     *
     * @return SQL 키워드 문자열
     */
    public String text() {
        return name();
    }

    /**
     * 키워드 토큰들을 공백 구분 phrase로 묶는다.
     * 예: phrase(LEFT, JOIN) -> "LEFT JOIN"
     *
     * @param keywords phrase를 구성할 키워드 토큰들
     * @return 키워드 토큰 묶음 객체
     */
    public static Phrase phrase(SqlKeyword... keywords) {
        if (keywords == null || keywords.length == 0) {
            throw new IllegalArgumentException("keywords must not be empty");
        }
        return new Phrase(List.copyOf(Arrays.asList(keywords)));
    }

    /**
     * 단일 키워드들을 각각 1-word phrase로 변환한다.
     *
     * @param keywords 단일 phrase로 만들 키워드 목록
     * @return 단일 키워드 phrase 목록
     */
    public static List<Phrase> singleWordPhrases(SqlKeyword... keywords) {
        return Arrays.stream(keywords).map(SqlKeyword::phrase).toList();
    }

    /**
     * "\s+(PHRASE1|PHRASE2...)\b" 형태 alternation 패턴을 생성한다.
     *
     * <p>Clause break 단계에서 "키워드 앞 공백"을 줄바꿈으로 치환할 때 사용한다.</p>
     *
     * @param phrases alternation 대상 phrase 목록
     * @return 키워드 앞 공백 매칭용 정규식 패턴
     */
    public static Pattern leadingWhitespaceAlternationPattern(List<Phrase> phrases) {
        return Pattern.compile("\\s+(" + alternationRegex(phrases) + ")\\b");
    }

    /**
     * 여러 phrase를 "|"로 연결한 alternation 정규식 조각을 생성한다.
     *
     * @param phrases alternation 대상 phrase 목록
     * @return 정규식 alternation 조각 문자열
     */
    public static String alternationRegex(List<Phrase> phrases) {
        return phrases.stream().map(Phrase::regexFragment).collect(Collectors.joining("|"));
    }

    /**
     * 키워드 phrase 값 객체.
     *
     * @param keywords phrase를 구성하는 키워드 목록
     */
    public record Phrase(List<SqlKeyword> keywords) {
        public Phrase {
            if (keywords == null || keywords.isEmpty()) {
                throw new IllegalArgumentException("keywords must not be empty");
            }
        }

        /**
         * 키워드 목록을 공백으로 연결한 원문 phrase 문자열.
         *
         * @return 공백 연결 phrase 원문
         */
        public String text() {
            return keywords.stream().map(SqlKeyword::text).collect(Collectors.joining(" "));
        }

        /**
         * 멀티워드 phrase를 정규식 조각으로 변환한다.
         *
         * <p>각 토큰은 Pattern.quote로 이스케이프하고, 토큰 사이는 "\s+"로 연결한다.</p>
         *
         * @return phrase 대응 정규식 조각 문자열
         */
        public String regexFragment() {
            return keywords.stream().map(SqlKeyword::text).map(Pattern::quote).collect(Collectors.joining("\\s+"));
        }

        /**
         * 단어 경계 기반 case-insensitive 매칭 패턴.
         *
         * @return phrase 경계 매칭 정규식 패턴
         */
        public Pattern wordBoundaryPattern() {
            return Pattern.compile("\\b" + regexFragment() + "\\b", Pattern.CASE_INSENSITIVE);
        }
    }
}
