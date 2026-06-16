package com.smarterd.domain.pm.wbs.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * WBS template payload JSON 직렬화/역직렬화를 담당한다.
 */
final class WbsPlanningPayloadJsonSupport {

    private static final TypeReference<WbsPlanningService.TemplatePayload> TEMPLATE_PAYLOAD_TYPE =
        new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    /**
     * @param objectMapper JSON object mapper
     */
    WbsPlanningPayloadJsonSupport(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * template payload를 JSON 문자열로 직렬화한다.
     *
     * @param payload template payload
     * @return JSON 문자열
     */
    String serializePayload(WbsPlanningService.TemplatePayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize WBS template payload", e);
        }
    }

    /**
     * JSON 문자열을 template payload로 역직렬화한다.
     *
     * @param payloadJson payload JSON
     * @return template payload
     */
    WbsPlanningService.TemplatePayload deserializePayload(String payloadJson) {
        try {
            return objectMapper.readValue(payloadJson, TEMPLATE_PAYLOAD_TYPE);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to deserialize WBS template payload", e);
        }
    }
}
