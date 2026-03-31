package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.channel.CollaborationResourceKey;
import com.smarterd.collaboration.channel.CollaborationResourceKeyFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;

/**
 * 다이어그램 채널의 협업 resource key 생성/해석 규칙.
 */
@Component
public class DiagramCollaborationResourceKeyFactory implements CollaborationResourceKeyFactory {

    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    /** 다이어그램 채널 타입 */
    public static final String CHANNEL_TYPE = "diagram";

    /** 다이어그램 WebSocket 경로 패턴 */
    public static final String WEBSOCKET_PATH_PATTERN = "/ws/diagram/{diagramId}";

    /**
     * {@inheritDoc}
     */
    @Override
    public String channelType() {
        return CHANNEL_TYPE;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CollaborationResourceKey create(String resourceId) {
        return new CollaborationResourceKey(channelType(), resourceId);
    }

    /**
     * 다이어그램 ID를 협업 resource key로 만든다.
     *
     * @param diagramId 다이어그램 ID
     * @return 협업 리소스 key
     */
    public CollaborationResourceKey forDiagramId(Long diagramId) {
        return create(String.valueOf(diagramId));
    }

    /**
     * WebSocket 경로를 협업 resource key로 해석한다.
     *
     * @param path 요청 경로
     * @return 협업 리소스 key
     */
    public CollaborationResourceKey fromWebSocketPath(String path) {
        if (!PATH_MATCHER.match(WEBSOCKET_PATH_PATTERN, path)) {
            throw new IllegalArgumentException("다이어그램 WebSocket 경로 패턴이 아님: " + path);
        }
        final var vars = PATH_MATCHER.extractUriTemplateVariables(WEBSOCKET_PATH_PATTERN, path);
        return create(vars.get("diagramId"));
    }

    /**
     * 협업 resource key를 다이어그램 ID로 파싱한다.
     *
     * @param resourceKey 협업 리소스 key
     * @return 다이어그램 ID
     */
    public Long parseDiagramId(CollaborationResourceKey resourceKey) {
        if (!channelType().equals(resourceKey.channelType())) {
            throw new IllegalArgumentException("다이어그램 채널에 맞지 않는 채널 타입: " + resourceKey.channelType());
        }
        return Long.parseLong(resourceKey.resourceId());
    }
}
