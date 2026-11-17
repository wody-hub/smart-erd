package com.smarterd.domain.common.exception;

import com.smarterd.domain.common.message.MessageCode;

/** 편집 프로토콜 업그레이드가 필요한 요청 예외 (HTTP 426). */
public class ProtocolTooOldException extends LocalizedException {

    /** 앱 새로고침이 필요한 편집 요청을 생성한다. */
    public ProtocolTooOldException() {
        super(MessageCode.ERROR_COLLABORATION_PROTOCOL_TOO_OLD.code());
    }
}
