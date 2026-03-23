package com.smarterd.collaboration.channel;

/**
 * 채널별 협업 리소스 key 생성 규칙을 제공하는 포트.
 *
 * <p>채널 타입마다 resourceId 표현과 파싱 규칙이 다를 수 있으므로,
 * key 생성 책임을 공통 협업 플러그인 계약에 포함한다.</p>
 */
public interface CollaborationResourceKeyFactory {

    /**
     * 이 factory가 담당하는 채널 타입을 반환한다.
     *
     * @return 채널 타입
     */
    String channelType();

    /**
     * 채널 내부 리소스 식별자를 공통 협업 리소스 key로 감싼다.
     *
     * @param resourceId 채널 내부 리소스 식별자 문자열
     * @return 공통 협업 리소스 key
     */
    CollaborationResourceKey create(String resourceId);
}
