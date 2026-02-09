package com.smarterd.domain.common.exception;

/**
 * 비즈니스 규칙 위반 시 발생하는 예외.
 */
public class BusinessException extends LocalizedException {

    public BusinessException(String messageCode, Object... messageArgs) {
        super(messageCode, messageArgs);
    }
}
