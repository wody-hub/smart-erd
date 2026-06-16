package com.smarterd.domain.dictionary.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.service.session.BulkValidationSessionStore;
import com.smarterd.utils.AppStringUtils;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * 벌크 검증 세션 토큰 발급, 조회, 소비를 담당한다.
 */
final class BulkValidationSessionManager {

    private static final int MAX_TOKEN_ISSUE_ATTEMPTS = 3;
    private static final Duration VALIDATION_SESSION_TTL = Duration.ofMinutes(10);

    private final BulkValidationSessionStore validationSessionStore;
    private final ObjectMapper objectMapper;

    /**
     * @param validationSessionStore 벌크 검증 세션 저장소
     * @param objectMapper JSON 직렬화/역직렬화
     */
    BulkValidationSessionManager(BulkValidationSessionStore validationSessionStore, ObjectMapper objectMapper) {
        this.validationSessionStore = validationSessionStore;
        this.objectMapper = objectMapper;
    }

    /**
     * 세션 객체를 저장하고 고유 토큰을 발급한다.
     *
     * @param keyPrefix 검증 세션 키 접두사
     * @param session 직렬화할 세션 객체
     * @return 발급된 토큰 문자열
     */
    String issueValidationToken(String keyPrefix, Object session) {
        for (var attempt = 0; attempt < MAX_TOKEN_ISSUE_ATTEMPTS; attempt++) {
            final var token = UUID.randomUUID().toString();
            final var key = Objects.requireNonNull(validationSessionKey(keyPrefix, token));
            final var payload = Objects.requireNonNull(serializeSession(session));
            final var stored = validationSessionStore.putIfAbsent(
                key,
                payload,
                Objects.requireNonNull(VALIDATION_SESSION_TTL)
            );
            if (stored) {
                return token;
            }
        }
        throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_ISSUE_FAILED.code());
    }

    /**
     * 검증 토큰을 소비하여 세션을 반환한다.
     *
     * @param keyPrefix 검증 세션 키 접두사
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param token 검증 토큰
     * @param sessionClass 세션 역직렬화 대상 클래스
     * @param <S> 세션 타입
     * @return 검증 세션 객체
     */
    <S> S consumeValidationSession(
        String keyPrefix,
        String loginId,
        Long teamId,
        Long setId,
        String token,
        Class<S> sessionClass
    ) {
        final var normalizedToken = normalizeValidationToken(token);
        final var consumeResult = validationSessionStore.consume(
            validationSessionKey(keyPrefix, normalizedToken),
            loginId,
            teamId,
            setId
        );
        if (consumeResult.status() == BulkValidationSessionStore.ConsumeStatus.MISSING) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        if (
            consumeResult.status() == BulkValidationSessionStore.ConsumeStatus.ALREADY_CONSUMED ||
            consumeResult.status() == BulkValidationSessionStore.ConsumeStatus.OWNERSHIP_MISMATCH
        ) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        return parseSessionOrThrow(Objects.requireNonNull(consumeResult.payload()), sessionClass);
    }

    /**
     * 검증 토큰으로 세션을 조회한다.
     *
     * @param keyPrefix 검증 세션 키 접두사
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param token 검증 토큰
     * @param sessionClass 세션 역직렬화 대상 클래스
     * @param <S> 세션 타입
     * @return 검증 세션 객체
     */
    <S> S resolveValidationSession(
        String keyPrefix,
        String loginId,
        Long teamId,
        Long setId,
        String token,
        Class<S> sessionClass
    ) {
        final var normalizedToken = normalizeValidationToken(token);
        final var key = Objects.requireNonNull(validationSessionKey(keyPrefix, normalizedToken));
        final var payload = validationSessionStore.get(key);
        if (payload == null || payload.isEmpty()) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        final var session = parseSessionOrThrow(payload, sessionClass);
        validateResolvedSession(key, loginId, teamId, setId, session);
        return session;
    }

    /**
     * 조회된 세션의 만료와 소유권을 검증한다.
     *
     * @param key 검증 세션 키
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param session 검증 세션 객체
     */
    private void validateResolvedSession(String key, String loginId, Long teamId, Long setId, Object session) {
        if (
            session instanceof BulkValidationSessionExpirable expirable && expirable.expiresAt().isBefore(Instant.now())
        ) {
            validationSessionStore.delete(key);
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        if (session instanceof BulkValidationSessionOwnership ownership) {
            if (
                !ownership.loginId().equals(loginId) ||
                !ownership.teamId().equals(teamId) ||
                !ownership.setId().equals(setId)
            ) {
                throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
            }
        }
    }

    /**
     * 검증 세션 저장소 키를 생성한다.
     *
     * @param keyPrefix 키 접두사
     * @param token 검증 토큰
     * @return 검증 세션 저장소 키
     */
    private String validationSessionKey(String keyPrefix, String token) {
        return keyPrefix + token;
    }

    /**
     * 검증 토큰을 정규화한다.
     *
     * @param token 원본 토큰
     * @return 정규화된 토큰
     */
    private String normalizeValidationToken(String token) {
        final var normalizedToken = AppStringUtils.trimToNull(token);
        if (normalizedToken == null) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
        return normalizedToken;
    }

    /**
     * 세션 객체를 JSON으로 직렬화한다.
     *
     * @param session 세션 객체
     * @return JSON 문자열
     */
    private String serializeSession(Object session) {
        try {
            return objectMapper.writeValueAsString(session);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize bulk validation session", e);
        }
    }

    /**
     * JSON에서 세션 객체를 역직렬화한다.
     *
     * @param payload JSON 문자열
     * @param sessionClass 대상 클래스
     * @param <S> 세션 타입
     * @return 역직렬화된 세션 객체
     */
    private <S> S parseSessionOrThrow(String payload, Class<S> sessionClass) {
        try {
            return objectMapper.readValue(payload, sessionClass);
        } catch (JsonProcessingException e) {
            throw new BusinessException(MessageCode.ERROR_BULK_VALIDATION_TOKEN_INVALID.code());
        }
    }
}

/**
 * 만료 시각을 가지는 벌크 검증 세션.
 */
interface BulkValidationSessionExpirable {
    /**
     * @return 만료 시각
     */
    Instant expiresAt();
}

/**
 * 소유자 정보를 가지는 벌크 검증 세션.
 */
interface BulkValidationSessionOwnership {
    /**
     * @return 사용자 로그인 ID
     */
    String loginId();

    /**
     * @return 팀 ID
     */
    Long teamId();

    /**
     * @return 사전 세트 ID
     */
    Long setId();
}
