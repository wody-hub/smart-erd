package com.smarterd.domain.user.repository;

import java.time.Instant;

/**
 * RefreshToken QueryDSL 커스텀 쿼리 인터페이스.
 */
public interface RefreshTokenRepositoryCustom {
    /**
     * 지정 시각 이전에 만료된 Refresh Token을 일괄 삭제한다.
     *
     * @param now 기준 시각
     * @return 삭제된 행 수
     */
    long deleteByExpiresAtBefore(Instant now);
}
