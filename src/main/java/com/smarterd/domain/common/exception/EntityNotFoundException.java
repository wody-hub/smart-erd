package com.smarterd.domain.common.exception;

/**
 * 요청한 엔티티를 찾을 수 없을 때 발생하는 예외.
 */
public class EntityNotFoundException extends RuntimeException {

    public EntityNotFoundException(String message) {
        super(message);
    }
}
