package com.smarterd.collaboration.plugin;

import java.util.Collection;
import java.util.Map;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * 문서 command를 generic lock scope로 해석하는 포트.
 */
public interface ScopeResolver {
    /**
     * command key와 payload를 scope 목록으로 해석한다.
     *
     * @param commandKey command key
     * @param payload command payload (없으면 null)
     * @return affected scope 목록
     */
    @NonNull
    Collection<ScopeRef> resolve(@NonNull String commandKey, @Nullable Map<String, ?> payload);
}
