package com.smarterd.domain.dictionary.service.session;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * in-memory 기반 벌크 업로드 검증 세션 저장소.
 *
 * <p>로컬 개발 및 단일 노드 환경을 기본 대상으로 하며, TTL이 지난 세션은 접근 시 지연 정리한다.</p>
 */
public class InMemoryBulkValidationSessionStore implements BulkValidationSessionStore {

    private final ConcurrentHashMap<String, StoredSession> sessions = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public InMemoryBulkValidationSessionStore(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean putIfAbsent(String key, String payload, Duration ttl) {
        final var now = Instant.now();
        final var expiresAt = now.plus(ttl);
        final var inserted = new AtomicBoolean(false);

        sessions.compute(key, (ignored, existing) -> {
            if (existing == null || existing.isExpired(now)) {
                inserted.set(true);
                return new StoredSession(payload, expiresAt);
            }
            return existing;
        });
        return inserted.get();
    }

    @Override
    public ConsumeResult consume(String key, String loginId, Long teamId, Long setId) {
        final var now = Instant.now();
        final var consumeResult = new AtomicReference<>(ConsumeResult.missing());

        sessions.compute(key, (ignored, existing) -> {
            if (existing == null || existing.isExpired(now)) {
                consumeResult.set(ConsumeResult.missing());
                return null;
            }

            final var payloadNode = readPayload(existing.payload());
            if (!matchesOwnership(payloadNode, loginId, teamId, setId)) {
                consumeResult.set(ConsumeResult.ownershipMismatch());
                return existing;
            }
            if (payloadNode.path("saveConsumed").asBoolean(false)) {
                consumeResult.set(ConsumeResult.alreadyConsumed());
                return existing;
            }

            payloadNode.put("saveConsumed", true);
            consumeResult.set(ConsumeResult.success(existing.payload()));
            return new StoredSession(writePayload(payloadNode), existing.expiresAt());
        });

        return consumeResult.get();
    }

    @Override
    public String get(String key) {
        final var now = Instant.now();
        final var existing = sessions.get(key);
        if (existing == null) {
            return null;
        }
        if (existing.isExpired(now)) {
            sessions.remove(key, existing);
            return null;
        }
        return existing.payload();
    }

    @Override
    public void delete(String key) {
        sessions.remove(key);
    }

    private ObjectNode readPayload(String payload) {
        try {
            return (ObjectNode) objectMapper.readTree(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to deserialize bulk validation session payload", e);
        }
    }

    private String writePayload(ObjectNode payloadNode) {
        try {
            return objectMapper.writeValueAsString(payloadNode);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize bulk validation session payload", e);
        }
    }

    private boolean matchesOwnership(ObjectNode payloadNode, String loginId, Long teamId, Long setId) {
        return loginId.equals(payloadNode.path("loginId").asText()) &&
        String.valueOf(teamId).equals(payloadNode.path("teamId").asText()) &&
        String.valueOf(setId).equals(payloadNode.path("setId").asText());
    }

    private record StoredSession(String payload, Instant expiresAt) {
        private boolean isExpired(Instant now) {
            return expiresAt.isBefore(now);
        }
    }
}
