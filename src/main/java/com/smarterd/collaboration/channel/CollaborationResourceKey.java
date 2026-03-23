package com.smarterd.collaboration.channel;

/**
 * 협업 리소스를 채널 타입과 리소스 식별자로 표현하는 공통 key.
 *
 * <p>1차 구현에서는 문자열 기반 식별자를 사용해 기존 diagramId(Long)와
 * 향후 다른 형상의 식별자를 같은 계약으로 감싼다.</p>
 *
 * @param channelType 협업 채널 타입
 * @param resourceId  채널 내부 리소스 식별자
 */
public record CollaborationResourceKey(
    String channelType,
    String resourceId
) {
}
