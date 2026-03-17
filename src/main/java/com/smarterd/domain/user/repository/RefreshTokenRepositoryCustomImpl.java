package com.smarterd.domain.user.repository;

import static com.smarterd.domain.user.entity.QRefreshToken.refreshToken;

import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.Instant;
import lombok.RequiredArgsConstructor;

/**
 * {@link RefreshTokenRepositoryCustom} QueryDSL 구현체.
 */
@RequiredArgsConstructor
public class RefreshTokenRepositoryCustomImpl implements RefreshTokenRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public long deleteByExpiresAtBefore(Instant now) {
        return queryFactory.delete(refreshToken).where(refreshToken.expiresAt.before(now)).execute();
    }
}
