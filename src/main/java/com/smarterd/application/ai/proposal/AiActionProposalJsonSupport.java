package com.smarterd.application.ai.proposal;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.utils.AppStringUtils;
import java.util.LinkedHashMap;
import java.util.Map;

final class AiActionProposalJsonSupport {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private AiActionProposalJsonSupport() {}

    static String writeJson(ObjectMapper objectMapper, Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "{}";
        }
    }

    static Map<String, Object> previewJson(AiActionPreviewService.PreviewData preview) {
        final var json = new LinkedHashMap<String, Object>();
        json.put("fields", preview.fields());
        json.put("content", preview.content());
        json.put("warnings", preview.warnings());
        return json;
    }

    static AiActionProposalView.Result resultView(ObjectMapper objectMapper, String json) {
        final var result = readMap(objectMapper, json);
        if (result.isEmpty()) {
            return null;
        }
        return new AiActionProposalView.Result(
            stringValue(result.get("actionType")),
            stringValue(result.get("resourceType")),
            stringValue(result.get("resourceId")),
            stringValue(result.get("targetLabel")),
            stringValue(result.get("status")),
            stringValue(result.get("summary"))
        );
    }

    static Map<String, Object> readMap(ObjectMapper objectMapper, String json) {
        if (AppStringUtils.isBlank(json)) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception ex) {
            return Map.of();
        }
    }

    static String safeDetail(String value) {
        if (AppStringUtils.isBlank(value)) {
            return "Execution failed.";
        }
        return value.length() <= 500 ? value : value.substring(0, 500);
    }

    /**
     * Converts nullable JSON values to strings.
     *
     * @param value JSON value
     * @return string value or null
     */
    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
