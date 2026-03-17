package com.smarterd.domain.user.repository;

import com.smarterd.domain.user.entity.LoginRateLimitAttempt;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 로그인 rate-limit 상태 레포지토리.
 */
public interface LoginRateLimitAttemptRepository extends JpaRepository<LoginRateLimitAttempt, String> {
    /**
     * 키로 상태를 비관적 락으로 조회한다.
     *
     * @param attemptKey 시도 상태 키
     * @return 시도 상태
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from LoginRateLimitAttempt a where a.attemptKey = :attemptKey")
    Optional<LoginRateLimitAttempt> findByAttemptKeyForUpdate(@Param("attemptKey") String attemptKey);

    /**
     * 지정 시각 이전에 갱신된 오래된 상태를 일괄 삭제한다.
     *
     * @param updatedAtMillis 기준 시각(epoch millis)
     * @return 삭제된 행 수
     */
    long deleteByUpdatedAtMillisLessThan(long updatedAtMillis);
}
