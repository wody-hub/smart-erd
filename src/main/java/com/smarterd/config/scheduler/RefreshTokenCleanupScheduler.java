package com.smarterd.config.scheduler;

import com.smarterd.config.security.AuthSecurityProperties;
import com.smarterd.domain.user.repository.RefreshTokenRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Refresh Token 정리 스케줄러.
 *
 * <p>설정된 주기로 실행되어 만료 토큰과 consume 보관 기간이 지난 토큰을 DB에서 정리한다.</p>
 */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RefreshTokenCleanupScheduler {

    /** Refresh Token 레포지토리 */
    private final RefreshTokenRepository refreshTokenRepository;
    /** 인증 보안 프로퍼티 */
    private final AuthSecurityProperties authSecurityProperties;

    /** 만료되었거나 consume 보관 기간이 지난 Refresh Token을 삭제한다. */
    @Scheduled(fixedRateString = "${smart-erd.auth.refresh-token-cleanup.cleanup-interval-millis:3600000}")
    @Transactional
    public void cleanupExpiredTokens() {
        final var now = Instant.now();
        final var consumedRetentionSeconds = authSecurityProperties
            .getRefreshTokenCleanup()
            .getConsumedRetentionSeconds();
        refreshTokenRepository.deleteByExpiresAtBefore(now);
        refreshTokenRepository.deleteByConsumedTrueAndConsumedAtBefore(now.minusSeconds(consumedRetentionSeconds));
    }
}
