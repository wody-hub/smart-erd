package com.smarterd.config.persistence.sqlformat.step;

/**
 * SQL 포맷 파이프라인 단일 단계 인터페이스.
 *
 * <p>입력 SQL을 받아 단계별 변환 결과를 반환한다. 구현체는 상태를 갖지 않는 것을 권장한다.</p>
 */
public interface SqlFormatStep {
    /**
     * 입력 SQL에 단계 규칙을 적용한 결과를 반환한다.
     */
    String apply(String sql);
}
