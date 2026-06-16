package com.smarterd.domain.dictionary.service;

import java.util.Locale;

/**
 * 벌크 엑셀 support 클래스가 서비스의 메시지 해석 함수를 사용할 수 있게 하는 함수형 인터페이스.
 */
@FunctionalInterface
interface BulkMessageResolver {
    /**
     * 메시지 코드를 로케일별 문구로 해석한다.
     *
     * @param code 메시지 코드
     * @param locale 로케일
     * @param args 메시지 인자
     * @return 해석된 메시지
     */
    String resolve(String code, Locale locale, Object... args);
}
