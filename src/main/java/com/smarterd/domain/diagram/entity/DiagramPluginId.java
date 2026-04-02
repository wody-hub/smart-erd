package com.smarterd.domain.diagram.entity;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import java.util.Arrays;

/**
 * 문서 aggregate가 지원하는 플러그인 ID.
 */
public enum DiagramPluginId {
    ERD("erd"),
    MARKDOWN("markdown");

    private final String value;

    DiagramPluginId(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static DiagramPluginId from(String value) {
        return Arrays.stream(values())
            .filter((pluginId) -> pluginId.value.equals(value))
            .findFirst()
            .orElseThrow(() -> new BusinessException(MessageCode.ERROR_BUSINESS_DOCUMENT_PLUGIN_UNSUPPORTED.code()));
    }
}
