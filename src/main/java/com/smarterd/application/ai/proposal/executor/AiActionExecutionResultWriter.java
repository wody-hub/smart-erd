package com.smarterd.application.ai.proposal.executor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.utils.AppStringUtils;
import java.util.LinkedHashMap;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

/**
 * Writes compact executor result metadata safe for proposal cards and history.
 */
@Component
public class AiActionExecutionResultWriter {

    private final ObjectMapper objectMapper;

    public AiActionExecutionResultWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String write(
        String actionType,
        String resourceType,
        @Nullable Object resourceId,
        @Nullable String targetLabel,
        String status,
        String summary
    ) {
        final var result = new LinkedHashMap<String, Object>();
        result.put("actionType", safe(actionType, 80));
        result.put("resourceType", safe(resourceType, 80));
        result.put("resourceId", resourceId == null ? null : safe(String.valueOf(resourceId), 80));
        result.put("targetLabel", safe(targetLabel, 200));
        result.put("status", safe(status, 40));
        result.put("summary", safe(summary, 300));
        try {
            return objectMapper.writeValueAsString(result);
        } catch (Exception ex) {
            return "{}";
        }
    }

    @Nullable
    private static String safe(@Nullable String value, int maxLength) {
        if (value == null) {
            return null;
        }
        final var normalized = AppStringUtils.trimToEmpty(value.replaceAll("[\\p{Cntrl}&&[^\n\t]]", ""));
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }
}
