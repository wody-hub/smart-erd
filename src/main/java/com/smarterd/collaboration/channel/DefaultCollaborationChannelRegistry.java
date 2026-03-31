package com.smarterd.collaboration.channel;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Spring 빈으로 등록된 협업 채널 정의를 채널 타입 기준으로 조회하는 기본 레지스트리.
 */
@Component
public class DefaultCollaborationChannelRegistry implements CollaborationChannelRegistry {

    private final Map<String, CollaborationChannelPlugin> definitionsByType;

    /**
     * 기본 생성자.
     *
     * @param plugins 등록된 채널 정의 목록
     */
    public DefaultCollaborationChannelRegistry(List<CollaborationChannelPlugin> plugins) {
        final var resolved = new LinkedHashMap<String, CollaborationChannelPlugin>();
        for (final var plugin : plugins) {
            if (!plugin.channelType().equals(plugin.resourceKeyFactory().channelType())) {
                throw new IllegalStateException(
                    "협업 채널 플러그인과 resource key factory의 채널 타입이 일치하지 않음: " + plugin.channelType()
                );
            }
            final var previous = resolved.putIfAbsent(plugin.channelType(), plugin);
            if (previous != null) {
                throw new IllegalStateException("중복된 협업 채널 플러그인 타입: " + plugin.channelType());
            }
        }
        this.definitionsByType = Map.copyOf(resolved);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CollaborationChannelPlugin getRequired(String channelType) {
        final var plugin = definitionsByType.get(channelType);
        if (plugin == null) {
            throw new IllegalStateException("등록되지 않은 협업 채널 타입: " + channelType);
        }
        return plugin;
    }
}
