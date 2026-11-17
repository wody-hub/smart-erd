package com.smarterd.config.websocket;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 협업 편집 프로토콜 설정. */
@Getter
@Setter
@ConfigurationProperties(prefix = "smart-erd.collaboration")
public class CollaborationProperties {

    /** 편집에 필요한 최소 프로토콜 버전. 기본 1은 기존 클라이언트를 허용한다. */
    private int minEditProtocolVersion = 1;
}
