package com.smarterd.collaboration.plugin;

import org.springframework.lang.NonNull;

/**
 * plugin domain 무결성 검증 훅.
 */
public interface DomainValidationHook {
    /**
     * snapshot을 plugin 도메인 규칙으로 검증한다.
     *
     * @param snapshot in-memory snapshot
     */
    void validate(@NonNull byte[] snapshot);
}
