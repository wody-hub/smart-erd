package com.smarterd.application.ai.proposal;

import com.smarterd.utils.AppStringUtils;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Reduces model-controlled action payloads to a small whitelisted JSON-safe shape.
 */
@Component
public class AiActionProposalSanitizer {

    private static final Set<String> ALLOWED_KEYS = Set.of(
        "targetType",
        "targetId",
        "targetLabel",
        "projectId",
        "teamId",
        "fields",
        "content",
        "assumptions",
        "labels"
    );

    public Map<String, Object> sanitize(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return Map.of();
        }
        final var sanitized = new LinkedHashMap<String, Object>();
        payload.forEach((key, value) -> {
            if (isAllowedKey(key) && !isSensitiveKey(key)) {
                final var safeValue = sanitizeValue(value);
                if (safeValue != null) {
                    sanitized.put(key, safeValue);
                }
            }
        });
        return Map.copyOf(sanitized);
    }

    private Object sanitizeValue(Object value) {
        if (value == null || value instanceof String || value instanceof Number || value instanceof Boolean) {
            return value;
        }
        if (value instanceof Map<?, ?> map) {
            final var sanitized = new LinkedHashMap<String, Object>();
            map.forEach((rawKey, rawValue) -> {
                if (rawKey instanceof String key && !isSensitiveKey(key)) {
                    final var nestedValue = sanitizeValue(rawValue);
                    if (nestedValue != null) {
                        sanitized.put(key, nestedValue);
                    }
                }
            });
            return Map.copyOf(sanitized);
        }
        if (value instanceof Iterable<?> iterable) {
            final var sanitized = new ArrayList<>();
            for (final var item : iterable) {
                final var nestedValue = sanitizeValue(item);
                if (nestedValue != null) {
                    sanitized.add(nestedValue);
                }
            }
            return List.copyOf(sanitized);
        }
        return String.valueOf(value);
    }

    private boolean isAllowedKey(String key) {
        return ALLOWED_KEYS.contains(key);
    }

    private boolean isSensitiveKey(String key) {
        final var normalized = AppStringUtils.lowerCaseToEmpty(key);
        return (
            normalized.contains("token") ||
            normalized.contains("cookie") ||
            normalized.contains("password") ||
            normalized.contains("secret") ||
            normalized.contains("credential") ||
            normalized.contains("env") ||
            normalized.contains("stdout") ||
            normalized.contains("stderr") ||
            normalized.contains("prompt") ||
            normalized.contains("context") ||
            normalized.contains("provideroutput") ||
            normalized.contains("shell") ||
            normalized.contains("command") ||
            normalized.contains("sql") ||
            normalized.contains("path")
        );
    }
}
