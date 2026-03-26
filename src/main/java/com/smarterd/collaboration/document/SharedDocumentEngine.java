package com.smarterd.collaboration.document;

import org.springframework.lang.NonNull;

/**
 * shared authoritative document engine 추상화.
 */
public interface SharedDocumentEngine {
    /**
     * 엔진 식별자를 반환한다.
     *
     * @return engine ID
     */
    @NonNull
    String engineId();

    /**
     * snapshot으로 엔진 상태를 hydrate한다.
     *
     * @param snapshot in-memory snapshot
     */
    void hydrate(@NonNull byte[] snapshot);

    /**
     * 현재 상태를 snapshot으로 export한다.
     *
     * @return in-memory snapshot
     */
    @NonNull
    byte[] exportSnapshot();

    /**
     * 원격 delta를 적용한다.
     *
     * @param delta remote delta
     */
    void applyRemoteDelta(@NonNull byte[] delta);
}
