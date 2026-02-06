package com.smarterd.domain.common.exception;

/**
 * 중복된 리소스가 존재할 때 발생하는 예외.
 */
public class DuplicateException extends RuntimeException {

    public DuplicateException(String message) {
        super(message);
    }
}
