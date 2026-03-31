package com.smarterd.collaboration.document;

import org.springframework.lang.NonNull;

/**
 * persistence 저장 포맷과 in-memory snapshot 사이를 변환하는 코덱.
 */
public interface DocumentSnapshotCodec {
    /**
     * persistence에 저장된 바이트를 in-memory snapshot으로 변환한다.
     *
     * @param persisted persisted 바이트
     * @return in-memory snapshot
     */
    @NonNull
    byte[] decodeToSnapshot(@NonNull byte[] persisted);

    /**
     * in-memory snapshot을 persistence 저장 포맷으로 변환한다.
     *
     * @param inMemorySnapshot in-memory snapshot
     * @return persistence 저장 바이트
     */
    @NonNull
    byte[] encodeForPersistence(@NonNull byte[] inMemorySnapshot);

    /**
     * 지원하는 스냅샷 포맷 버전을 반환한다.
     *
     * @return snapshot format version
     */
    int snapshotFormatVersion();
}
