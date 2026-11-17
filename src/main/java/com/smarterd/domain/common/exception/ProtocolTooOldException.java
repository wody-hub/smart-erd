package com.smarterd.domain.common.exception;

import com.smarterd.domain.common.message.MessageCode;

/** 편집 프로토콜 업그레이드가 필요한 요청 예외 (HTTP 426). */
public class ProtocolTooOldException extends LocalizedException {

    /** 거부 시점의 최소 편집 프로토콜 버전. */
    private final int minEditProtocolVersion;

    /**
     * 앱 새로고침이 필요한 편집 요청을 생성한다.
     * @param minEditProtocolVersion 거부 시점의 최소 버전
     */
    public ProtocolTooOldException(int minEditProtocolVersion) {
        super(MessageCode.ERROR_COLLABORATION_PROTOCOL_TOO_OLD.code());
        this.minEditProtocolVersion = minEditProtocolVersion;
    }

    /**
     * 거부 시점의 최소 버전을 반환한다.
     * @return 최소 편집 프로토콜 버전
     */
    public int getMinEditProtocolVersion() {
        return minEditProtocolVersion;
    }
}
