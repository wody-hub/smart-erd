package com.smarterd.collaboration.metadata;

import org.springframework.lang.NonNull;

/**
 * 문서 메타데이터와 접근 권한을 조회하는 포트.
 */
public interface DocumentMetadataService {
    /**
     * 요청자가 접근 가능한 문서 메타데이터를 조회한다.
     *
     * @param documentId 문서 ID
     * @param requesterId 요청자 식별자
     * @return 문서 메타데이터
     */
    @NonNull
    DocumentMetadata loadDocumentMetadata(@NonNull Long documentId, @NonNull String requesterId);
}
