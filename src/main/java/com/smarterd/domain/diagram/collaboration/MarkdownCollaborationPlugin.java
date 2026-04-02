package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.plugin.BaseCollaborationPlugin;
import com.smarterd.collaboration.plugin.DomainValidationHook;
import com.smarterd.collaboration.plugin.ScopeResolver;
import java.util.Set;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;

/**
 * markdown 문서 플러그인.
 *
 * <p>section-update 커맨드를 section-level scope로 해석하는
 * MarkdownScopeResolver를 제공한다.</p>
 */
@Component
public class MarkdownCollaborationPlugin implements BaseCollaborationPlugin {

    private static final String PLUGIN_ID = "markdown";
    private static final int SCHEMA_VERSION = 1;
    private static final Set<String> SUPPORTED_ENGINE_IDS = Set.of("yjs");

    private final MarkdownScopeResolver scopeResolver;

    /**
     * 기본 생성자.
     *
     * <p>MarkdownScopeResolver를 내부에서 생성한다.
     * DomainValidationHook은 현재 no-op으로 동작한다.</p>
     */
    public MarkdownCollaborationPlugin() {
        this.scopeResolver = new MarkdownScopeResolver();
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @NonNull
    public String pluginId() {
        return PLUGIN_ID;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public int schemaVersion() {
        return SCHEMA_VERSION;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @NonNull
    public Set<String> supportedEngineIds() {
        return SUPPORTED_ENGINE_IDS;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    @NonNull
    public ScopeResolver scopeResolver() {
        return scopeResolver;
    }

    /**
     * {@inheritDoc}
     *
     * <p>현재 markdown 플러그인은 도메인 검증을 수행하지 않는다 (no-op).</p>
     */
    @Override
    @NonNull
    public DomainValidationHook validationHook() {
        return (snapshot) -> {
            // no-op: markdown 플러그인은 현재 도메인 검증을 수행하지 않는다
        };
    }
}
