package com.smarterd.collaboration;

import com.smarterd.config.websocket.CollaborationProperties;
import com.smarterd.domain.common.exception.ProtocolTooOldException;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

/** REST와 WebSocket에서 공유하는 최소 편집 프로토콜 정책. */
@Component
@RequiredArgsConstructor
public class CollaborationProtocolPolicy {

    /** REST 클라이언트 버전 헤더. */
    public static final String CLIENT_PROTOCOL_HEADER = "X-Smart-Erd-Client-Protocol";
    /** WebSocket 정책 거부 사유 및 attributes 키. */
    public static final String PROTOCOL_TOO_OLD = "protocol-too-old";
    /** 협업 설정. */
    private final CollaborationProperties properties;

    /**
     * REST 버전을 해석한다. 누락, 비정수, 양수가 아닌 값은 레거시 v1이다.
     * @param value 요청 헤더 값
     * @return 유효 버전
     */
    public int restVersion(@Nullable String value) {
        try {
            return Math.max(1, Integer.parseInt(value));
        } catch (NumberFormatException e) {
            return 1;
        }
    }

    /**
     * 유효 버전의 편집 허용 여부를 반환한다.
     * @param version REST 또는 협상된 WS 버전
     * @return 편집 허용 여부
     */
    public boolean allowsEdit(int version) {
        return version >= properties.getMinEditProtocolVersion();
    }

    /**
     * 구버전의 REST 편집을 거부한다.
     * @param version 클라이언트 유효 버전
     */
    public void requireEditVersion(int version) {
        if (!allowsEdit(version)) {
            throw new ProtocolTooOldException();
        }
    }
}
