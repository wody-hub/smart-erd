package com.smarterd.domain.user.repository;

import com.smarterd.domain.user.entity.RefreshToken;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Refresh Token JPA 레포지토리.
 */
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long>, RefreshTokenRepositoryCustom {
    /** 토큰 문자열로 Refresh Token을 조회한다. */
    Optional<RefreshToken> findByToken(String token);
}
