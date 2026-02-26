package com.smarterd.config.persistence.sqlformat.rule;

import java.util.regex.Pattern;

/**
 * 정규식 치환 규칙.
 *
 * <p>패턴과 치환 문자열을 하나의 값 객체로 묶어 단계별 규칙 리스트를 단순화한다.</p>
 */
public record RegexRule(Pattern pattern, String replacement) {}
