package com.smarterd.domain.dictionary.service.session;

import java.time.Duration;
import org.springframework.lang.Nullable;

/**
 * 벌크 업로드 검증 세션 저장소.
 *
 * <p>검증 결과를 임시 저장하고, 저장 요청 시 단일 소비(consume) semantics를 제공한다.
 * 구현체는 in-memory 또는 Redis를 선택할 수 있다.</p>
 */
public interface BulkValidationSessionStore {
    /**
     * 동일 키가 없을 때만 세션 payload를 저장한다.
     *
     * @param key     저장 키
     * @param payload JSON payload
     * @param ttl     세션 TTL
     * @return 저장 성공 여부
     */
    boolean putIfAbsent(String key, String payload, Duration ttl);

    /**
     * 세션을 소유자 기준으로 검증하고 consume 처리한다.
     *
     * @param key     저장 키
     * @param loginId 요청 사용자 loginId
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @return consume 결과
     */
    ConsumeResult consume(String key, String loginId, Long teamId, Long setId);

    /**
     * 세션 payload를 조회한다.
     *
     * @param key 저장 키
     * @return payload, 없거나 만료되었으면 {@code null}
     */
    @Nullable
    String get(String key);

    /**
     * 세션을 삭제한다.
     *
     * @param key 저장 키
     */
    void delete(String key);

    /**
     * consume 결과.
     *
     * @param status consume 상태
     * @param payload 성공 시 원본 payload
     */
    record ConsumeResult(ConsumeStatus status, @Nullable String payload) {
        public static ConsumeResult success(String payload) {
            return new ConsumeResult(ConsumeStatus.SUCCESS, payload);
        }

        public static ConsumeResult missing() {
            return new ConsumeResult(ConsumeStatus.MISSING, null);
        }

        public static ConsumeResult ownershipMismatch() {
            return new ConsumeResult(ConsumeStatus.OWNERSHIP_MISMATCH, null);
        }

        public static ConsumeResult alreadyConsumed() {
            return new ConsumeResult(ConsumeStatus.ALREADY_CONSUMED, null);
        }
    }

    /**
     * consume 상태.
     */
    enum ConsumeStatus {
        SUCCESS,
        MISSING,
        OWNERSHIP_MISMATCH,
        ALREADY_CONSUMED,
    }
}
