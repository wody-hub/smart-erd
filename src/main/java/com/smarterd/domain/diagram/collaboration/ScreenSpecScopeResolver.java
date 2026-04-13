package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.plugin.ScopeLockMode;
import com.smarterd.collaboration.plugin.ScopeRef;
import com.smarterd.collaboration.plugin.ScopeResolver;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * 화면기획 문서 command를 마스터/화면/인스턴스/레이어 scope로 해석한다.
 */
public class ScreenSpecScopeResolver implements ScopeResolver {

    private static final ScopeRef MASTERS_SCOPE = new ScopeRef("masters", "collection", ScopeLockMode.SHARED);

    /**
     * command key와 payload를 screen-spec 문서 scope로 해석한다.
     *
     * @param commandKey command key
     * @param payload command payload
     * @return affected scope 목록
     */
    @Override
    @NonNull
    public Collection<ScopeRef> resolve(@NonNull String commandKey, @Nullable Map<String, ?> payload) {
        final var masterId = readString(payload, "masterId");
        final var screenId = readString(payload, "screenId");
        final var instanceId = readString(payload, "instanceId");

        if ("master:add".equals(commandKey)) {
            return List.of(MASTERS_SCOPE);
        }

        if ("master:update".equals(commandKey) || "master:delete".equals(commandKey)) {
            return masterId == null
                ? List.of()
                : List.of(new ScopeRef("master", masterId, ScopeLockMode.EXCLUSIVE));
        }

        if (
            "screen:add".equals(commandKey) ||
            "screen:rename".equals(commandKey) ||
            "screen:update-frame".equals(commandKey) ||
            "screen:move".equals(commandKey) ||
            "screen:delete".equals(commandKey)
        ) {
            return screenId == null
                ? List.of()
                : List.of(new ScopeRef("screen", screenId, ScopeLockMode.EXCLUSIVE));
        }

        if ("instance:add".equals(commandKey) || "instance:update".equals(commandKey) || "instance:delete".equals(commandKey)) {
            return Stream.of(
                screenId == null ? null : new ScopeRef("screen", screenId, ScopeLockMode.SHARED),
                screenId == null ? null : new ScopeRef("layer", screenId, ScopeLockMode.SHARED),
                instanceId == null ? null : new ScopeRef("instance", instanceId, ScopeLockMode.EXCLUSIVE),
                masterId == null ? null : new ScopeRef("master", masterId, ScopeLockMode.SHARED)
            ).filter(Objects::nonNull).toList();
        }

        if ("layer:move".equals(commandKey)) {
            return Stream.of(
                screenId == null ? null : new ScopeRef("screen", screenId, ScopeLockMode.SHARED),
                screenId == null ? null : new ScopeRef("layer", screenId, ScopeLockMode.EXCLUSIVE),
                instanceId == null ? null : new ScopeRef("instance", instanceId, ScopeLockMode.SHARED)
            ).filter(Objects::nonNull).toList();
        }

        return List.of();
    }

    /**
     * payload에서 비어 있지 않은 문자열 값을 읽는다.
     *
     * @param payload command payload
     * @param key 읽을 필드 이름
     * @return trim된 문자열, 없으면 null
     */
    @Nullable
    private static String readString(@Nullable Map<String, ?> payload, @NonNull String key) {
        if (payload == null) {
            return null;
        }
        final var value = payload.get(key);
        if (!(value instanceof String stringValue)) {
            return null;
        }
        final var trimmed = stringValue.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
