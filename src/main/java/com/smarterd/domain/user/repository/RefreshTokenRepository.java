package com.smarterd.domain.user.repository;

import com.smarterd.domain.user.entity.RefreshToken;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Refresh Token JPA 레포지토리.
 */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    /** 토큰 문자열로 Refresh Token을 조회한다. */
    Optional<RefreshToken> findByToken(String token);

    /** 지정 시각 이전에 만료된 Refresh Token을 일괄 삭제한다. */
    @Modifying
    @Query("DELETE FROM RefreshToken rt WHERE rt.expiresAt < :now")
    int deleteByExpiresAtBefore(@Param("now") Instant now);
}
