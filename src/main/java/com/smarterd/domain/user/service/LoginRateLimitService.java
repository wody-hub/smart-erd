package com.smarterd.domain.user.service;

import com.smarterd.config.security.AuthSecurityProperties;
import com.smarterd.domain.user.entity.LoginRateLimitAttempt;
import com.smarterd.domain.user.repository.LoginRateLimitAttemptRepository;
import com.smarterd.utils.AppStringUtils;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인 실패 기반 Rate Limiting 서비스.
 *
 * <p>상태를 DB에 저장하여 다중 인스턴스 환경에서도 동일한 제한 정책을 적용한다.</p>
 */
@Service
@RequiredArgsConstructor
public class LoginRateLimitService {

    private static final int MAX_CREATE_RETRY_COUNT = 3;

    private final LoginRateLimitAttemptRepository loginRateLimitAttemptRepository;
    private final AuthSecurityProperties authSecurityProperties;

    /**
     * 현재 로그인 시도가 차단 상태인지 확인한다.
     *
     * @param loginId 로그인 ID
     * @param clientIp 클라이언트 IP
     * @return 차단 상태이면 true
     */
    @Transactional
    public boolean isBlocked(String loginId, String clientIp) {
        final var attemptKey = toAttemptKey(loginId, clientIp);
        final var now = System.currentTimeMillis();
        final var attempt = findOrCreateAttemptForUpdate(attemptKey, now);
        return attempt.isBlocked(now);
    }

    /**
     * 로그인 실패를 기록한다.
     *
     * @param loginId 로그인 ID
     * @param clientIp 클라이언트 IP
     */
    @Transactional
    public void recordFailure(String loginId, String clientIp) {
        final var attemptKey = toAttemptKey(loginId, clientIp);
        final var now = System.currentTimeMillis();
        final var loginRateLimitConfig = authSecurityProperties.getLoginRateLimit();
        final var windowMillis = loginRateLimitConfig.getWindowSeconds() * 1000L;
        final var blockMillis = loginRateLimitConfig.getBlockSeconds() * 1000L;
        final var attempt = findOrCreateAttemptForUpdate(attemptKey, now);
        attempt.normalize(now, windowMillis);
        attempt.recordFailure(now, loginRateLimitConfig.getMaxFailedAttempts(), blockMillis);
        loginRateLimitAttemptRepository.save(attempt);
    }

    /**
     * 로그인 성공 시 누적 실패 상태를 초기화한다.
     *
     * @param loginId 로그인 ID
     * @param clientIp 클라이언트 IP
     */
    @Transactional
    public void reset(String loginId, String clientIp) {
        loginRateLimitAttemptRepository.deleteById(Objects.requireNonNull(toAttemptKey(loginId, clientIp)));
    }

    /**
     * 오래된 로그인 시도 상태를 정리한다.
     *
     * @return 삭제된 행 수
     */
    @Transactional
    public long cleanupStaleAttempts() {
        final var now = System.currentTimeMillis();
        final var staleRetentionMillis = authSecurityProperties.getLoginRateLimit().getStaleRetentionSeconds() * 1000L;
        return loginRateLimitAttemptRepository.deleteByUpdatedAtMillisLessThan(now - staleRetentionMillis);
    }

    /**
     * 로그인 ID와 클라이언트 IP를 정규화하여 시도 키를 생성한다.
     *
     * @param loginId 로그인 ID
     * @param clientIp 클라이언트 IP
     * @return 정규화된 시도 키
     */
    private String toAttemptKey(String loginId, String clientIp) {
        final var normalizedLoginId = AppStringUtils.lowerTrimToEmpty(
            Objects.requireNonNull(loginId, "loginId must not be null")
        );
        final var normalizedClientIp = AppStringUtils.trimToEmpty(
            Objects.requireNonNull(clientIp, "clientIp must not be null")
        );
        return normalizedClientIp + ":" + normalizedLoginId;
    }

    /**
     * 시도 키에 해당하는 상태를 비관적 락으로 조회하고, 없으면 생성한다.
     *
     * @param attemptKey 로그인 시도 키
     * @param now 현재 시각(epoch millis)
     * @return 조회 또는 생성된 시도 상태
     */
    private LoginRateLimitAttempt findOrCreateAttemptForUpdate(String attemptKey, long now) {
        for (var retry = 0; retry < MAX_CREATE_RETRY_COUNT; retry++) {
            final var existingAttempt = loginRateLimitAttemptRepository
                .findByAttemptKeyForUpdate(attemptKey)
                .orElse(null);
            if (existingAttempt != null) {
                return existingAttempt;
            }

            try {
                final var newAttempt = new LoginRateLimitAttempt(attemptKey, now);
                return loginRateLimitAttemptRepository.saveAndFlush(newAttempt);
            } catch (DataIntegrityViolationException ex) {
                if (!isRetryableUniqueConstraintViolation(ex) || retry == MAX_CREATE_RETRY_COUNT - 1) {
                    throw ex;
                }
            }
        }

        throw new IllegalStateException("Failed to create login rate-limit attempt state");
    }

    /**
     * 재시도 가능한 유니크 제약 위반 예외인지 확인한다.
     *
     * @param ex 데이터 무결성 예외
     * @return 유니크 제약 위반으로 재시도 가능하면 {@code true}
     */
    private boolean isRetryableUniqueConstraintViolation(DataIntegrityViolationException ex) {
        final var rootCause = getRootCause(ex);
        if (rootCause instanceof java.sql.SQLIntegrityConstraintViolationException) {
            return true;
        }
        final var message = ex.getMessage();
        if (message == null) {
            return false;
        }
        return AppStringUtils.containsIgnoreCase(message, "unique") ||
            AppStringUtils.containsIgnoreCase(message, "duplicate");
    }

    /**
     * 예외 체인의 최하위 원인을 반환한다.
     *
     * @param throwable 대상 예외
     * @return 최하위 원인 예외
     */
    private Throwable getRootCause(Throwable throwable) {
        var root = throwable;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        return root;
    }
}
