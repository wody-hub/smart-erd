package com.smarterd.collaboration.channel;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Spring 빈으로 등록된 채널 런타임 support를 채널 타입 기준으로 조회하는 기본 레지스트리.
 */
@Component
public class DefaultCollaborationRuntimeSupportRegistry implements CollaborationRuntimeSupportRegistry {

    private final Map<String, CollaborationRuntimeSupport> supportsByType;

    /**
     * 기본 생성자.
     *
     * @param supports 등록된 채널 런타임 support 목록
     */
    public DefaultCollaborationRuntimeSupportRegistry(List<CollaborationRuntimeSupport> supports) {
        final var resolved = new LinkedHashMap<String, CollaborationRuntimeSupport>();
        for (final var support : supports) {
            final var previous = resolved.putIfAbsent(support.channelType(), support);
            if (previous != null) {
                throw new IllegalStateException("중복된 협업 채널 runtime support 타입: " + support.channelType());
            }
        }
        this.supportsByType = Map.copyOf(resolved);
    }

    @Override
    public CollaborationRuntimeSupport getRequired(String channelType) {
        final var support = supportsByType.get(channelType);
        if (support == null) {
            throw new IllegalStateException("등록되지 않은 협업 채널 runtime support 타입: " + channelType);
        }
        return support;
    }
}
