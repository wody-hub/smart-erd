package com.smarterd.collaboration.plugin;

import java.util.Set;
import org.springframework.lang.NonNull;

/**
 * 협업 문서 플러그인의 기본 계약.
 */
public interface BaseCollaborationPlugin {
    /**
     * 플러그인 ID를 반환한다.
     *
     * @return plugin ID
     */
    @NonNull
    String pluginId();

    /**
     * 플러그인 스키마 버전을 반환한다.
     *
     * @return schema version
     */
    int schemaVersion();

    /**
     * 지원하는 엔진 ID 목록을 반환한다.
     *
     * @return supported engine IDs
     */
    @NonNull
    Set<String> supportedEngineIds();

    /**
     * scope resolver를 반환한다.
     *
     * @return scope resolver
     */
    @NonNull
    ScopeResolver scopeResolver();

    /**
     * 도메인 검증 훅을 반환한다.
     *
     * @return domain validation hook
     */
    @NonNull
    DomainValidationHook validationHook();
}
