package com.smarterd.collaboration.persistence;

import com.smarterd.collaboration.document.DocumentCheckpoint;
import java.util.Optional;
import org.springframework.lang.NonNull;

/**
 * checkpoint 저장과 persisted 문서 조회를 담당하는 persistence 포트.
 */
public interface DocumentPersistenceCoordinator {
    /**
     * checkpoint를 영속화한다.
     *
     * @param checkpoint 저장 대상 checkpoint
     */
    void checkpoint(@NonNull DocumentCheckpoint checkpoint);

    /**
     * persisted 문서를 조회한다.
     *
     * @param documentId 문서 ID
     * @return persisted 문서
     */
    @NonNull
    Optional<PersistedDocument> load(@NonNull Long documentId);
}
