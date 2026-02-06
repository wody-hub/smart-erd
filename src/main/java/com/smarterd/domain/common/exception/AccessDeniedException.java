package com.smarterd.domain.common.exception;

/**
 * 요청한 작업에 대한 권한이 없을 때 발생하는 예외.
 */
public class AccessDeniedException extends RuntimeException {

    public AccessDeniedException(String message) {
        super(message);
    }
}
