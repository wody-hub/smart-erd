package com.smarterd.domain.diagram.entity;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import java.util.Arrays;
import java.util.Set;

/**
 * 문서 aggregate가 지원하는 플러그인 ID.
 */
public enum DiagramPluginId {
    ERD("erd", null),
    MARKDOWN("markdown", MessageCode.ERROR_BUSINESS_MARKDOWN_DICTIONARY_CONTEXT_NOT_ALLOWED),
    SCREEN_SPEC(
        "screen-spec",
        Set.of("screendesign"),
        MessageCode.ERROR_BUSINESS_SCREEN_SPEC_DICTIONARY_CONTEXT_NOT_ALLOWED
    );

    private final String value;
    private final Set<String> aliases;
    private final MessageCode dictionaryContextNotAllowedMessage;

    DiagramPluginId(String value) {
        this(value, Set.of(), null);
    }

    DiagramPluginId(String value, MessageCode dictionaryContextNotAllowedMessage) {
        this(value, Set.of(), dictionaryContextNotAllowedMessage);
    }

    DiagramPluginId(String value, Set<String> aliases, MessageCode dictionaryContextNotAllowedMessage) {
        this.value = value;
        this.aliases = aliases;
        this.dictionaryContextNotAllowedMessage = dictionaryContextNotAllowedMessage;
    }

    /**
     * 플러그인의 canonical ID를 반환한다.
     *
     * @return 저장/조회에 사용하는 plugin ID
     */
    public String value() {
        return value;
    }

    /**
     * 플러그인이 dictionary context를 필수로 요구하는지 반환한다.
     *
     * @return ERD면 true, 그 외는 false
     */
    public boolean requiresDictionaryContext() {
        return this == ERD;
    }

    /**
     * 플러그인이 템플릿 기반 생성 흐름을 지원하는지 반환한다.
     *
     * @return markdown면 true, 그 외는 false
     */
    public boolean supportsTemplates() {
        return this == MARKDOWN;
    }

    /**
     * dictionarySet 지정이 허용되지 않을 때 반환할 메시지 코드를 제공한다.
     *
     * @return 플러그인별 dictionary context 불가 메시지 코드
     */
    public MessageCode getDictionaryContextNotAllowedMessage() {
        if (dictionaryContextNotAllowedMessage == null) {
            throw new IllegalStateException("Dictionary context is required for plugin: " + value);
        }
        return dictionaryContextNotAllowedMessage;
    }

    /**
     * 후보 문자열이 canonical ID 또는 alias와 일치하는지 판별한다.
     *
     * @param candidate 검사할 plugin ID 후보
     * @return 일치하면 true
     */
    private boolean matches(String candidate) {
        return value.equals(candidate) || aliases.contains(candidate);
    }

    /**
     * 저장된 문자열을 enum 값으로 정규화한다.
     *
     * @param value 정규화할 plugin ID 문자열
     * @return 매칭된 enum 값
     */
    public static DiagramPluginId from(String value) {
        return Arrays.stream(values())
            .filter((pluginId) -> pluginId.matches(value))
            .findFirst()
            .orElseThrow(() -> new BusinessException(MessageCode.ERROR_BUSINESS_DOCUMENT_PLUGIN_UNSUPPORTED.code()));
    }
}
