package com.smarterd.collaboration.persistence;

import org.springframework.lang.NonNull;

/**
 * persistence bootstrap header를 읽는 포트.
 */
public interface DocumentBootstrapReader {
    /**
     * 문서의 bootstrap header를 조회한다.
     *
     * @param documentId 문서 ID
     * @return bootstrap header
     */
    @NonNull
    DocumentBootstrapHeader loadBootstrapHeader(@NonNull Long documentId);
}
