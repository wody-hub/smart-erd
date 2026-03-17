package com.smarterd.domain.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 로그인 실패 기반 rate-limit 상태 엔티티.
 *
 * <p>키(`clientIp:loginId`) 단위로 실패 횟수와 차단 만료 시각을 저장한다.</p>
 */
@Entity
@Table(
    name = "login_rate_limit_attempts",
    indexes = { @Index(name = "idx_login_rate_limit_updated_at", columnList = "updated_at_millis") }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LoginRateLimitAttempt {

    /** 시도 상태 키 (`clientIp:loginId`) */
    @Id
    @Column(name = "attempt_key", nullable = false, length = 320)
    private String attemptKey;

    /** 현재 실패 윈도우 시작 시각(epoch millis) */
    @Column(name = "window_start_millis", nullable = false)
    private long windowStartMillis;

    /** 현재 윈도우 내 누적 실패 횟수 */
    @Column(name = "failed_count", nullable = false)
    private int failedCount;

    /** 로그인 차단 만료 시각(epoch millis), 미차단 시 0 */
    @Column(name = "blocked_until_millis", nullable = false)
    private long blockedUntilMillis;

    /** 마지막 갱신 시각(epoch millis) */
    @Column(name = "updated_at_millis", nullable = false)
    private long updatedAtMillis;

    /**
     * 초기 시도 상태를 생성한다.
     *
     * @param attemptKey 시도 상태 키
     * @param now 현재 시각(epoch millis)
     */
    public LoginRateLimitAttempt(String attemptKey, long now) {
        this.attemptKey = attemptKey;
        this.windowStartMillis = now;
        this.failedCount = 0;
        this.blockedUntilMillis = 0;
        this.updatedAtMillis = now;
    }

    /**
     * 현재 시각 기준으로 블록 상태인지 확인한다.
     *
     * @param now 현재 시각(epoch millis)
     * @return 차단 중이면 {@code true}
     */
    public boolean isBlocked(long now) {
        return blockedUntilMillis > now;
    }

    /**
     * 윈도우 만료 또는 차단 만료 시 상태를 초기화한다.
     *
     * @param now 현재 시각(epoch millis)
     * @param windowMillis 실패 카운팅 윈도우(밀리초)
     */
    public void normalize(long now, long windowMillis) {
        final var windowExpired = now - windowStartMillis >= windowMillis;
        final var blockExpired = blockedUntilMillis > 0 && now >= blockedUntilMillis;
        if (windowExpired || blockExpired) {
            windowStartMillis = now;
            failedCount = 0;
            blockedUntilMillis = 0;
        }
        updatedAtMillis = now;
    }

    /**
     * 로그인 실패 1회를 기록하고 필요 시 차단 상태로 전환한다.
     *
     * @param now 현재 시각(epoch millis)
     * @param maxFailedAttempts 차단 임계 실패 횟수
     * @param blockMillis 차단 시간(밀리초)
     */
    public void recordFailure(long now, int maxFailedAttempts, long blockMillis) {
        failedCount++;
        if (failedCount >= maxFailedAttempts) {
            windowStartMillis = now;
            blockedUntilMillis = now + blockMillis;
        }
        updatedAtMillis = now;
    }
}
