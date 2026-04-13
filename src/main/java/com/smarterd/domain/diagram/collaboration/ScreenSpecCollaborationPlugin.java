package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.plugin.BaseCollaborationPlugin;
import com.smarterd.collaboration.plugin.DomainValidationHook;
import com.smarterd.collaboration.plugin.ScopeResolver;
import java.util.Set;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;

/**
 * 화면기획 문서 플러그인 골격.
 */
@Component
public class ScreenSpecCollaborationPlugin implements BaseCollaborationPlugin {

    private static final String PLUGIN_ID = "screen-spec";
    private static final int SCHEMA_VERSION = 1;
    private static final Set<String> SUPPORTED_ENGINE_IDS = Set.of("yjs");

    private final ScopeResolver scopeResolver;

    /**
     * screen-spec 플러그인에 사용할 scope resolver를 초기화한다.
     */
    public ScreenSpecCollaborationPlugin() {
        this.scopeResolver = new ScreenSpecScopeResolver();
    }

    /**
     * 플러그인 식별자를 반환한다.
     *
     * @return canonical plugin ID
     */
    @Override
    @NonNull
    public String pluginId() {
        return PLUGIN_ID;
    }

    /**
     * 플러그인 schema version을 반환한다.
     *
     * @return schema version
     */
    @Override
    public int schemaVersion() {
        return SCHEMA_VERSION;
    }

    /**
     * 지원하는 협업 엔진 식별자 목록을 반환한다.
     *
     * @return 지원 엔진 ID 집합
     */
    @Override
    @NonNull
    public Set<String> supportedEngineIds() {
        return SUPPORTED_ENGINE_IDS;
    }

    /**
     * mutation scope 해석기를 반환한다.
     *
     * @return screen-spec scope resolver
     */
    @Override
    @NonNull
    public ScopeResolver scopeResolver() {
        return scopeResolver;
    }

    /**
     * 도메인 구조 검증 훅을 반환한다.
     *
     * @return 현재 단계에서는 no-op validation hook
     */
    @Override
    @NonNull
    public DomainValidationHook validationHook() {
        return (snapshot) -> {
            // Phase 3-01 skeleton: structural validation is added when the domain schema lands.
        };
    }
}
