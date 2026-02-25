package com.smarterd.domain.user.repository;

import com.smarterd.domain.user.entity.RefreshToken;
import com.smarterd.domain.user.entity.User;
import java.time.Instant;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Refresh Token JPA 레포지토리.
 */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long>, RefreshTokenRepositoryCustom {
    /** 토큰 문자열로 Refresh Token을 조회한다. */
    Optional<RefreshToken> findByToken(String token);

    /** 토큰 문자열로 Refresh Token을 비관적 락으로 조회한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select rt from RefreshToken rt join fetch rt.user where rt.token = :token")
    Optional<RefreshToken> findByTokenForUpdate(@Param("token") String token);

    /** 사용자의 Refresh Token을 모두 삭제한다. */
    long deleteByUser(User user);

    /** 사용 처리 후 보관 기간이 지난 Refresh Token을 삭제한다. */
    long deleteByConsumedTrueAndConsumedAtBefore(Instant cutoff);
}
