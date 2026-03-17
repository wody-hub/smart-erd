package com.smarterd.domain.common.exception;

/**
 * 요청 횟수 제한 초과(429 Too Many Requests) 예외.
 */
public class TooManyRequestsException extends LocalizedException {

    public TooManyRequestsException(String messageCode, Object... messageArgs) {
        super(messageCode, messageArgs);
    }
}
