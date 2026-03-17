package com.smarterd.config.scheduler;

import com.smarterd.domain.user.service.LoginRateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 로그인 rate-limit 상태 정리 스케줄러.
 */
@Component
@RequiredArgsConstructor
public class LoginRateLimitCleanupScheduler {

    /** 로그인 rate-limit 서비스 */
    private final LoginRateLimitService loginRateLimitService;

    /**
     * 오래된 로그인 시도 상태를 주기적으로 정리한다.
     */
    @Scheduled(fixedRateString = "${smart-erd.auth.login-rate-limit.cleanup-interval-millis:600000}")
    public void cleanupStaleAttempts() {
        loginRateLimitService.cleanupStaleAttempts();
    }
}
