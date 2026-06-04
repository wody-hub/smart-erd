package com.smarterd.application.ai.proposal.executor;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.ai.AiActionProposal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

/**
 * Reads executor inputs from server-owned sanitized proposal payload JSON.
 */
@Component
public class AiActionPayloadReader {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public AiActionPayloadReader(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Payload read(AiActionProposal proposal) {
        final var payload = readMap(proposal.getSanitizedPayloadJson());
        return new Payload(
            stringOrNull(payload.get("targetType"), proposal.getTargetType()),
            stringOrNull(payload.get("targetId"), proposal.getTargetId()),
            stringOrNull(payload.get("targetLabel"), proposal.getTargetLabel()),
            stringOrNull(payload.get("content"), null),
            readFields(payload.get("fields"))
        );
    }

    private Map<String, Object> readMap(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception ex) {
            throw invalid();
        }
    }

    private Map<String, FieldValue> readFields(Object value) {
        if (!(value instanceof Iterable<?> iterable)) {
            return Map.of();
        }
        final var fields = new LinkedHashMap<String, FieldValue>();
        for (final var item : iterable) {
            if (!(item instanceof Map<?, ?> map)) {
                throw invalid();
            }
            final var name = firstString(map, "name", "key", "field", "label");
            if (name == null || name.isBlank()) {
                throw invalid();
            }
            final var normalized = normalize(name);
            final var hasAfter = map.containsKey("afterValue");
            final var hasValue = map.containsKey("value");
            final var hasBefore = map.containsKey("beforeValue");
            final var afterValue = hasAfter ? map.get("afterValue") : map.get("value");
            fields.put(normalized, new FieldValue(name, hasBefore, map.get("beforeValue"), hasAfter || hasValue, afterValue));
        }
        return Map.copyOf(fields);
    }

    @Nullable
    private static String firstString(Map<?, ?> map, String... keys) {
        for (final var key : keys) {
            final var value = map.get(key);
            if (value != null) {
                return String.valueOf(value);
            }
        }
        return null;
    }

    @Nullable
    private static String stringOrNull(@Nullable Object value, @Nullable String fallback) {
        if (value == null) {
            return fallback;
        }
        final var string = String.valueOf(value).trim();
        return string.isEmpty() ? fallback : string;
    }

    static String normalize(String value) {
        return value
            .trim()
            .toLowerCase(Locale.ROOT)
            .replace("_", "")
            .replace("-", "")
            .replace(" ", "");
    }

    static IllegalArgumentException invalid() {
        return new IllegalArgumentException("Invalid AI proposal payload.");
    }

    static IllegalArgumentException stale() {
        return new IllegalArgumentException("Current data changed since the proposal was created.");
    }

    public record Payload(
        @Nullable String targetType,
        @Nullable String targetId,
        @Nullable String targetLabel,
        @Nullable String content,
        Map<String, FieldValue> fields
    ) {
        public Payload {
            fields = fields == null ? Map.of() : Map.copyOf(fields);
        }

        public void requireTargetType(String expected) {
            if (!Objects.equals(normalize(expected), normalize(Objects.toString(targetType, "")))) {
                throw invalid();
            }
        }

        public Long requireTargetId() {
            if (targetId == null || targetId.isBlank()) {
                throw invalid();
            }
            try {
                return Long.valueOf(targetId.trim());
            } catch (NumberFormatException ex) {
                throw invalid();
            }
        }

        public String requireContent() {
            final var normalized = trimToNull(content);
            if (normalized == null) {
                throw invalid();
            }
            return normalized;
        }

        public void requireOnlyFields(Set<String> allowedFields) {
            final var allowed = allowedFields.stream().map(AiActionPayloadReader::normalize).collect(java.util.stream.Collectors.toSet());
            for (final var name : fields.keySet()) {
                if (!allowed.contains(name)) {
                    throw invalid();
                }
            }
        }

        public boolean hasField(String name) {
            return fields.containsKey(normalize(name));
        }

        public void assertBeforeMatches(String name, @Nullable Object currentValue) {
            final var field = fields.get(normalize(name));
            if (field == null || !field.hasBeforeValue()) {
                return;
            }
            final var expected = comparable(field.beforeValue());
            if (expected == null) {
                return;
            }
            if (!Objects.equals(expected, comparable(currentValue))) {
                throw stale();
            }
        }

        public String requiredString(String name) {
            final var value = trimToNull(stringValue(name, null));
            if (value == null) {
                throw invalid();
            }
            return value;
        }

        @Nullable
        public String stringValue(String name, @Nullable String fallback) {
            final var field = fields.get(normalize(name));
            if (field == null) {
                return fallback;
            }
            if (!field.hasAfterValue()) {
                throw invalid();
            }
            return trimToNull(field.afterValue() == null ? null : String.valueOf(field.afterValue()));
        }

        @Nullable
        public Long longValue(String name, @Nullable Long fallback) {
            final var field = fields.get(normalize(name));
            if (field == null) {
                return fallback;
            }
            if (!field.hasAfterValue() || field.afterValue() == null) {
                return null;
            }
            try {
                return Long.valueOf(String.valueOf(field.afterValue()).trim());
            } catch (NumberFormatException ex) {
                throw invalid();
            }
        }

        public int intValue(String name, int fallback) {
            final var field = fields.get(normalize(name));
            if (field == null) {
                return fallback;
            }
            if (!field.hasAfterValue() || field.afterValue() == null) {
                throw invalid();
            }
            try {
                return Integer.parseInt(String.valueOf(field.afterValue()).trim());
            } catch (NumberFormatException ex) {
                throw invalid();
            }
        }

        @Nullable
        public LocalDate dateValue(String name, @Nullable LocalDate fallback) {
            final var field = fields.get(normalize(name));
            if (field == null) {
                return fallback;
            }
            if (!field.hasAfterValue() || field.afterValue() == null) {
                return null;
            }
            final var value = trimToNull(String.valueOf(field.afterValue()));
            if (value == null) {
                return null;
            }
            try {
                return LocalDate.parse(value);
            } catch (RuntimeException ex) {
                throw invalid();
            }
        }

        @Nullable
        public <E extends Enum<E>> E enumValue(String name, Class<E> enumType, @Nullable E fallback) {
            final var field = fields.get(normalize(name));
            if (field == null) {
                return fallback;
            }
            if (!field.hasAfterValue() || field.afterValue() == null) {
                return null;
            }
            final var value = trimToNull(String.valueOf(field.afterValue()));
            if (value == null) {
                return null;
            }
            try {
                return Enum.valueOf(enumType, value.toUpperCase(Locale.ROOT));
            } catch (RuntimeException ex) {
                throw invalid();
            }
        }

        @Nullable
        private static String trimToNull(@Nullable String value) {
            if (value == null) {
                return null;
            }
            final var trimmed = value.trim();
            return trimmed.isEmpty() ? null : trimmed;
        }

        @Nullable
        private static String comparable(@Nullable Object value) {
            if (value == null) {
                return "";
            }
            final var string = String.valueOf(value).trim();
            return string.isEmpty() ? null : string;
        }
    }

    public record FieldValue(
        String name,
        boolean hasBeforeValue,
        @Nullable Object beforeValue,
        boolean hasAfterValue,
        @Nullable Object afterValue
    ) {}
}
