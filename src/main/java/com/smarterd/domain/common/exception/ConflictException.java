package com.smarterd.domain.common.exception;

/**
 * 비즈니스 충돌(409 Conflict) 예외.
 */
public class ConflictException extends LocalizedException {

    public ConflictException(String messageCode, Object... messageArgs) {
        super(messageCode, messageArgs);
    }
}

