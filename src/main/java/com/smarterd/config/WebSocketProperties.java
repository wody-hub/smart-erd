package com.smarterd.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * WebSocket 설정 프로퍼티.
 *
 * <p>{@code application.yml}의 {@code smart-erd.websocket.*} 프로퍼티와 바인딩된다.</p>
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "smart-erd.websocket")
public class WebSocketProperties {

    /** 방당 최대 동시 접속 세션 수 */
    private int maxSessionsPerRoom = 10;

    /** 세션별 초당 최대 메시지 수 */
    private int maxMessagesPerSecond = 100;

    /** WebSocket 바이너리 메시지 최대 크기 (바이트) */
    private int binaryMessageSizeLimit = 1024 * 1024;

    /** dirty 스냅샷 flush 주기 (밀리초) */
    private long snapshotFlushInterval = 30000;
}
