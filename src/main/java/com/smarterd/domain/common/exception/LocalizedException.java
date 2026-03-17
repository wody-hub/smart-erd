package com.smarterd.domain.common.exception;

import lombok.Getter;

/**
 * 다국어 메시지 코드를 담는 예외 베이스 클래스.
 *
 * <p>{@link org.springframework.context.MessageSource}에서 메시지 코드와 인자를 사용해
 * 로케일에 맞는 에러 메시지를 해석한다.</p>
 */
@Getter
public abstract class LocalizedException extends RuntimeException {

    /** 메시지 프로퍼티 키 (예: "error.not-found.team") */
    private final String messageCode;

    /** MessageFormat 인자 (예: teamId) */
    private final transient Object[] messageArgs;

    /**
     * @param messageCode 메시지 프로퍼티 키
     * @param messageArgs MessageFormat 치환 인자
     */
    protected LocalizedException(String messageCode, Object... messageArgs) {
        super(messageCode);
        this.messageCode = messageCode;
        this.messageArgs = messageArgs;
    }
}
