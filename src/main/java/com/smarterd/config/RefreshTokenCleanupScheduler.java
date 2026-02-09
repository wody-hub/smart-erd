package com.smarterd.config;

import com.smarterd.domain.user.repository.RefreshTokenRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 만료된 Refresh Token 정리 스케줄러.
 *
 * <p>1시간마다 실행되어 만료 시각이 지난 Refresh Token을 DB에서 일괄 삭제한다.</p>
 */
@Component
@RequiredArgsConstructor
public class RefreshTokenCleanupScheduler {

    /** Refresh Token 레포지토리 */
    private final RefreshTokenRepository refreshTokenRepository;

    /** 만료된 Refresh Token을 삭제한다 (1시간 간격). */
    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void cleanupExpiredTokens() {
        refreshTokenRepository.deleteByExpiresAtBefore(Instant.now());
    }
}
